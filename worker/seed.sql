-- 清空现有数据（可选，仅用于测试）
DELETE FROM items;

-- 插入根目录下的文件夹
INSERT INTO items (id, parentId, name, type) VALUES 
('folder-1', 'root', 'Documents', 'folder'),
('folder-2', 'root', 'Pictures', 'folder');

-- 插入 Documents 文件夹下的文件 (id: folder-1)
INSERT INTO items (id, parentId, name, type, size, contentType, r2Key) VALUES 
('file-1', 'folder-1', 'manual.pdf', 'file', 102400, 'application/pdf', 'files/mock-manual-pdf');

-- 插入根目录下的文件
INSERT INTO items (id, parentId, name, type, size, contentType, r2Key) VALUES 
('file-2', 'root', 'hello.txt', 'file', 512, 'text/plain', 'files/mock-hello-txt');
