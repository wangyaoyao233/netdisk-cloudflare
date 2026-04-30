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
	mediaType?: 'video';
	videoStatus?: 'pending' | 'processing' | 'completed' | 'failed';
	hlsPath?: string;
	thumbnailPath?: string;
	duration?: number;
	width?: number;
	height?: number;
	videoError?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface MediaJob {
	id: string;
	itemId: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	workerId?: string;
	errorMessage?: string;
	createdAt?: string;
	updatedAt?: string;
	claimedAt?: string;
	completedAt?: string;
}

/**
 * 标准 CORS 响应头
 */
const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

function isVideoContentType(contentType?: string): boolean {
	return Boolean(contentType?.toLowerCase().startsWith('video/'));
}

function normalizeOptionalNumber(value: unknown): number | null {
	if (value === undefined || value === null || value === '') return null;
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? Math.round(numberValue) : null;
}

function detectVideoStreamContentType(fileName: string): string {
	if (fileName.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
	if (fileName.endsWith('.ts')) return 'video/mp2t';
	return 'application/octet-stream';
}

function isImageContentType(contentType?: string): boolean {
	return Boolean(contentType?.toLowerCase().startsWith('image/'));
}

async function deleteR2Prefix(bucket: R2Bucket, prefix: string): Promise<void> {
	let cursor: string | undefined;

	do {
		const listed = await bucket.list({ prefix, cursor });
		const keys = listed.objects.map((object) => object.key);

		if (keys.length > 0) {
			await bucket.delete(keys);
		}

		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);
}

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

				const shouldCreateVideoJob = isVideoContentType(contentType);
				const mediaType = shouldCreateVideoJob ? 'video' : null;
				const videoStatus = shouldCreateVideoJob ? 'pending' : null;

				// 记录元数据到数据库
				await env.DB.prepare(
					'INSERT INTO items (id, parentId, name, type, size, contentType, r2Key, mediaType, videoStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
				).bind(id, parentId, name, 'file', size, contentType, r2Key, mediaType, videoStatus).run();

				if (shouldCreateVideoJob) {
					await env.DB.prepare(
						'INSERT INTO media_jobs (id, itemId, status) VALUES (?, ?, ?)'
					).bind(crypto.randomUUID(), id, 'pending').run();
				}

				return jsonResponse({ id, name, parentId, type: 'file' }, 201);
			}

			// 领取视频转码任务: POST /api/media/jobs/claim
			if (path === '/api/media/jobs/claim' && method === 'POST') {
				const { workerId } = await request.json() as { workerId?: string };
				if (!workerId) return errorResponse('Missing workerId', 400);

				const job = await env.DB.prepare(
					`SELECT media_jobs.id, media_jobs.itemId, items.name, items.r2Key, items.contentType
					 FROM media_jobs
					 INNER JOIN items ON items.id = media_jobs.itemId
					 WHERE media_jobs.status = ?
					 ORDER BY media_jobs.createdAt ASC
					 LIMIT 1`
				).bind('pending').first<{ id: string; itemId: string; name: string; r2Key: string; contentType?: string }>();

				if (!job) {
					return new Response(null, { status: 204, headers: CORS_HEADERS });
				}

				const updateResult = await env.DB.prepare(
					`UPDATE media_jobs
					 SET status = ?, workerId = ?, claimedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
					 WHERE id = ? AND status = ?`
				).bind('processing', workerId, job.id, 'pending').run();

				if (updateResult.meta.changes === 0) {
					return new Response(null, { status: 204, headers: CORS_HEADERS });
				}

				await env.DB.prepare(
					'UPDATE items SET videoStatus = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
				).bind('processing', job.itemId).run();

				return jsonResponse({
					jobId: job.id,
					itemId: job.itemId,
					fileName: job.name,
					sourceR2Key: job.r2Key,
					contentType: job.contentType,
				});
			}

			// 回写视频转码结果: PATCH /api/items/:id/video-metadata
			if (path.startsWith('/api/items/') && path.endsWith('/video-metadata') && method === 'PATCH') {
				const id = path.split('/')[3];
				if (!id) return errorResponse('Missing item ID', 400);

				const payload = await request.json() as {
					jobId?: string;
					videoStatus?: 'completed' | 'failed';
					hlsPath?: string;
					thumbnailPath?: string;
					duration?: number;
					width?: number;
					height?: number;
					errorMessage?: string;
				};

				if (!payload.jobId) return errorResponse('Missing jobId', 400);
				if (payload.videoStatus !== 'completed' && payload.videoStatus !== 'failed') {
					return errorResponse('Invalid videoStatus', 400);
				}

				const job = await env.DB.prepare(
					'SELECT id, itemId, status FROM media_jobs WHERE id = ? AND itemId = ?'
				).bind(payload.jobId, id).first<MediaJob>();

				if (!job) return errorResponse('Media job not found', 404);
				if (job.status !== 'processing') return errorResponse('Media job is not processing', 409);

				const duration = normalizeOptionalNumber(payload.duration);
				const width = normalizeOptionalNumber(payload.width);
				const height = normalizeOptionalNumber(payload.height);
				const errorMessage = payload.videoStatus === 'failed' ? payload.errorMessage || 'Transcode failed' : null;

				await env.DB.batch([
					env.DB.prepare(
						`UPDATE items
						 SET videoStatus = ?, hlsPath = ?, thumbnailPath = ?, duration = ?, width = ?, height = ?, videoError = ?, updatedAt = CURRENT_TIMESTAMP
						 WHERE id = ?`
					).bind(
						payload.videoStatus,
						payload.hlsPath || null,
						payload.thumbnailPath || null,
						duration,
						width,
						height,
						errorMessage,
						id
					),
					env.DB.prepare(
						`UPDATE media_jobs
						 SET status = ?, errorMessage = ?, completedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
						 WHERE id = ?`
					).bind(payload.videoStatus, errorMessage, payload.jobId),
				]);

				return jsonResponse({ id, videoStatus: payload.videoStatus });
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

			// 获取预览链接: GET /api/items/:id/preview
			if (path.startsWith('/api/items/') && path.endsWith('/preview') && method === 'GET') {
				const id = path.split('/')[3];
				const item = await env.DB.prepare('SELECT r2Key, name, contentType FROM items WHERE id = ?').bind(id).first<ItemMetadata>();

				if (!item || !item.r2Key) return errorResponse('File not found', 404);

				const client = createS3Client(env);
				const command = new GetObjectCommand({
					Bucket: env.BUCKET_NAME,
					Key: item.r2Key,
					ResponseContentDisposition: 'inline',
					ResponseContentType: item.contentType
				});
				const url = await getSignedUrl(client, command, { expiresIn: 3600 });

				return jsonResponse({ url });
			}

			// 获取缩略图: GET /api/items/:id/thumbnail
			if (path.startsWith('/api/items/') && path.endsWith('/thumbnail') && method === 'GET') {
				const id = path.split('/')[3];
				const item = await env.DB.prepare(
					'SELECT type, r2Key, contentType, mediaType, videoStatus, thumbnailPath FROM items WHERE id = ?'
				).bind(id).first<ItemMetadata>();

				if (!item || item.type !== 'file') return errorResponse('File not found', 404);

				let objectKey: string | undefined;
				let contentType = item.contentType || 'application/octet-stream';

				if (item.mediaType === 'video') {
					if (item.videoStatus !== 'completed' || !item.thumbnailPath) {
						return errorResponse('Video thumbnail is not ready', 409);
					}

					objectKey = item.thumbnailPath;
					contentType = 'image/jpeg';
				} else if (isImageContentType(item.contentType) && item.r2Key) {
					objectKey = item.r2Key;
				}

				if (!objectKey) return errorResponse('Thumbnail not available', 404);

				const object = await env.MY_BUCKET.get(objectKey);
				if (!object) return errorResponse('Thumbnail not found', 404);

				return new Response(object.body, {
					headers: {
						...CORS_HEADERS,
						'Content-Type': contentType,
						'Cache-Control': item.mediaType === 'video'
							? 'private, max-age=3600'
							: 'private, max-age=300',
					},
				});
			}

			// HLS 视频流代理: GET /api/video/stream/:fileId/index.m3u8 或 segment-xxxxx.ts
			if (path.startsWith('/api/video/stream/') && method === 'GET') {
				const parts = path.split('/');
				const fileId = parts[4];
				const fileName = parts[5];

				if (!fileId || !fileName || parts.length !== 6 || fileName.includes('..') || fileName.includes('/')) {
					return errorResponse('Invalid video stream path', 400);
				}

				const item = await env.DB.prepare(
					'SELECT id, type, mediaType, videoStatus, hlsPath FROM items WHERE id = ?'
				).bind(fileId).first<ItemMetadata>();

				if (!item || item.type !== 'file' || item.mediaType !== 'video') {
					return errorResponse('Video not found', 404);
				}

				if (item.videoStatus !== 'completed' || !item.hlsPath) {
					return errorResponse('Video is not ready', 409);
				}

				const objectKey = fileName === 'index.m3u8' ? item.hlsPath : `hls/${fileId}/${fileName}`;
				const object = await env.MY_BUCKET.get(objectKey);

				if (!object) return errorResponse('Video segment not found', 404);

				return new Response(object.body, {
					headers: {
						...CORS_HEADERS,
						'Content-Type': detectVideoStreamContentType(fileName),
						'Cache-Control': fileName.endsWith('.m3u8')
							? 'private, max-age=30'
							: 'public, max-age=31536000, immutable',
					},
				});
			}

			// 删除项目: DELETE /api/items/:id
			if (path.startsWith('/api/items/') && method === 'DELETE') {
				const id = path.split('/')[3];
				if (!id) return errorResponse('Missing item ID', 400);

				const item = await env.DB.prepare(
					'SELECT type, r2Key, mediaType, videoStatus, hlsPath, thumbnailPath FROM items WHERE id = ?'
				).bind(id).first<ItemMetadata>();

				if (!item) return errorResponse('Item not found', 404);
				if (item.mediaType === 'video' && item.videoStatus === 'processing') {
					return errorResponse('Video is processing', 409);
				}

				// 如果是文件，物理删除 R2 对象
				if (item.type === 'file' && item.r2Key) {
					// 最佳实践：Worker 内部操作 R2 建议直接使用绑定，无需 S3 签名凭证
					await env.MY_BUCKET.delete(item.r2Key);
				}

				if (item.type === 'file' && item.mediaType === 'video') {
					await deleteR2Prefix(env.MY_BUCKET, `hls/${id}/`);

					if (item.thumbnailPath) {
						await env.MY_BUCKET.delete(item.thumbnailPath);
					}
				}

				await env.DB.prepare('DELETE FROM media_jobs WHERE itemId = ?').bind(id).run();

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
