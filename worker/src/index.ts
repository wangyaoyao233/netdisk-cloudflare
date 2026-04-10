import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * 环境变量与绑定接口
 */
export interface Env {
	MY_BUCKET: R2Bucket;
	DB: D1Database;
	R2_ACCOUNT_ID: string;
	R2_ACCESS_KEY_ID: string;
	R2_SECRET_ACCESS_KEY: string;
	BUCKET_NAME: string;
}

/**
 * 数据库元数据模型
 */
export interface ItemMetadata {
	id: string;
	parentId: string;
	name: string;
	type: 'file' | 'folder';
	size?: number;
	contentType?: string;
	r2Key?: string;
	createdAt?: string;
	updatedAt?: string;
}

/**
 * 标准 CORS 响应头
 */
const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * 创建 S3 兼容客户端
 */
function createS3Client(env: Env) {
	return new S3Client({
		region: "auto",
		endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		},
	});
}

/**
 * 统一响应辅助函数
 */
const jsonResponse = (data: any, status = 200) => 
	new Response(JSON.stringify(data), { 
		status, 
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
	});

const errorResponse = (message: string, status = 500) => 
	new Response(message, { status, headers: CORS_HEADERS });

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		console.log(`[${method}] ${path}`);

		// 1. 处理 CORS 预检
		if (method === 'OPTIONS') {
			return new Response(null, { headers: CORS_HEADERS });
		}

		try {
			// --- 路由逻辑 ---

			// 健康检查
			if (path === '/ping' && method === 'GET') {
				return new Response('pong', { headers: CORS_HEADERS });
			}

			// 获取列表: GET /api/items?parentId=xxx
			if (path === '/api/items' && method === 'GET') {
				const parentId = url.searchParams.get('parentId') || 'root';
				const { results } = await env.DB.prepare(
					'SELECT * FROM items WHERE parentId = ? ORDER BY type DESC, name ASC'
				).bind(parentId).all<ItemMetadata>();
				return jsonResponse(results);
			}

			// 创建文件夹: POST /api/folders
			if (path === '/api/folders' && method === 'POST') {
				const { name, parentId = 'root' } = await request.json() as { name: string, parentId?: string };
				if (!name) return errorResponse('Missing folder name', 400);

				const id = crypto.randomUUID();
				await env.DB.prepare(
					'INSERT INTO items (id, parentId, name, type) VALUES (?, ?, ?, ?)'
				).bind(id, parentId, name, 'folder').run();

				return jsonResponse({ id, name, parentId, type: 'folder' });
			}

			// 获取上传链接: POST /api/items/upload
			if (path === '/api/items/upload' && method === 'POST') {
				const { name, size, contentType, parentId = 'root' } = await request.json() as any;
				if (!name) return errorResponse('Missing file name', 400);

				const id = crypto.randomUUID();
				const r2Key = `files/${crypto.randomUUID()}`;

				const client = createS3Client(env);

				// 规范写法：明确锁定 ContentType 到签名中
				const finalContentType = contentType || 'application/octet-stream';
				const command = new PutObjectCommand({
					Bucket: env.BUCKET_NAME,
					Key: r2Key,
					ContentType: finalContentType,
				});

				// 规范写法：生成包含 Content-Type 签名的 URL
				const uploadUrl = await getSignedUrl(client, command, {
					expiresIn: 3600
				});

				return jsonResponse({
					id,
					uploadUrl,
					r2Key,
					contentType: finalContentType
				});
			}

			// 保存文件元数据: POST /api/items (上传成功后调用)
			if (path === '/api/items' && method === 'POST') {
				const { id, parentId, name, size, contentType, r2Key } = await request.json() as any;
				if (!id || !name || !r2Key) return errorResponse('Missing metadata', 400);

				// 记录元数据到数据库
				await env.DB.prepare(
					'INSERT INTO items (id, parentId, name, type, size, contentType, r2Key) VALUES (?, ?, ?, ?, ?, ?, ?)'
				).bind(id, parentId, name, 'file', size, contentType, r2Key).run();

				return jsonResponse({ id, name, parentId, type: 'file' }, 201);
			}

			// 获取下载链接: GET /api/items/:id/download
			if (path.startsWith('/api/items/') && path.endsWith('/download') && method === 'GET') {
				const id = path.split('/')[3];
				const item = await env.DB.prepare('SELECT r2Key, name FROM items WHERE id = ?').bind(id).first<ItemMetadata>();
				
				if (!item || !item.r2Key) return errorResponse('File not found', 404);

				const client = createS3Client(env);
				const command = new GetObjectCommand({
					Bucket: env.BUCKET_NAME,
					Key: item.r2Key,
					ResponseContentDisposition: `attachment; filename="${encodeURIComponent(item.name)}"`
				});
				const url = await getSignedUrl(client, command, { expiresIn: 3600 });
				
				return jsonResponse({ url });
			}

			// 删除项目: DELETE /api/items/:id
			if (path.startsWith('/api/items/') && method === 'DELETE') {
				const id = path.split('/')[3];
				if (!id) return errorResponse('Missing item ID', 400);

				const item = await env.DB.prepare('SELECT type, r2Key FROM items WHERE id = ?').bind(id).first<ItemMetadata>();
				
				if (!item) return errorResponse('Item not found', 404);

				// 如果是文件，物理删除 R2 对象
				if (item.type === 'file' && item.r2Key) {
					// 最佳实践：Worker 内部操作 R2 建议直接使用绑定，无需 S3 签名凭证
					await env.MY_BUCKET.delete(item.r2Key);
				}

				// 删除数据库记录
				await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run();
				
				return new Response(null, { status: 204, headers: CORS_HEADERS });
			}

			return errorResponse('Not Found', 404);

		} catch (error: any) {
			console.error('Runtime Error:', error);
			// 返回更详细的错误信息便于调试
			return errorResponse(error.stack || error.message, 500);
		}
	},
} satisfies ExportedHandler<Env>;
