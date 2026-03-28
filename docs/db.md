# 数据库设计文档 (Cloudflare D1)

本项目采用 **元数据 (Metadata) 与 存储 (Storage) 分离** 的架构。Cloudflare D1 (SQLite) 负责管理文件系统的层级结构和属性，而 Cloudflare R2 仅作为纯粹的二进制大对象存储。

## 1. 数据表结构: `items`

这是系统中最核心的表，用于存储文件和文件夹的统一元数据。

```sql
CREATE TABLE items (
    id TEXT PRIMARY KEY,          -- 唯一 ID (UUID)
    parentId TEXT,                -- 父文件夹 ID (根目录为 'root')
    name TEXT NOT NULL,           -- 显示名称 (例如: "我的图片.jpg")
    type TEXT NOT NULL,           -- 类型: 'file' 或 'folder'
    size INTEGER,                 -- 文件大小 (字节, 文件夹为 NULL)
    contentType TEXT,             -- MIME 类型 (例如: "image/jpeg")
    r2Key TEXT,                   -- R2 桶中的物理 Key (例如: "files/uuid")
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引：加速按父目录查询
CREATE INDEX idx_items_parentId ON items(parentId);
```

---

## 2. 核心设计思路

### 2.1 逻辑与物理的彻底解耦
*   **设计**：用户看到的 `name` (文件名) 存储在数据库中，而 R2 中的物理 `r2Key` 是一串随机的 UUID（例如 `files/550e8400-e29b...`）。
*   **优化思路**：
    *   **秒级重命名**：重命名文件或文件夹时，只需修改数据库的一行 `name` 字段，无需移动 R2 中的数据。
    *   **秒级移动**：移动文件到另一个文件夹，只需修改 `parentId`，无需物理复制。
    *   **安全性**：即使 R2 桶不慎泄露，攻击者也无法通过物理 Key 猜出原始文件名或层级结构。

### 2.2 扁平化存储结构 (R2 侧)
*   **设计**：R2 中不创建任何物理“目录”。所有文件都平铺在 `files/` 前缀下。
*   **优化思路**：对象存储在处理极深路径时性能可能会下降。通过平铺存储，我们可以规避对象存储的路径限制，将层级管理的复杂性完全交给 SQL 数据库处理。

### 2.3 统一实体模型 (Items)
*   **设计**：文件和文件夹共用一张表，通过 `type` 字段区分。
*   **优化思路**：
    *   **查询简化**：只需要一条 SQL (`WHERE parentId = ?`) 即可同时获取当前目录下的所有子文件夹和文件。
    *   **层级一致性**：文件夹和文件在系统逻辑中被视为同等地位的“条目”。

---

## 3. 性能优化方案

### 3.1 覆盖索引 (Covering Index)
*   我们在 `parentId` 上建立了索引。在执行 `SELECT * FROM items WHERE parentId = ?` 时，数据库可以极快地定位到特定目录下的内容。
*   **进阶优化建议**：如果未来文件量达到百万级，可以考虑复合索引 `(parentId, type, name)`，进一步提升排序和过滤性能。

### 3.2 递归操作处理
*   **文件夹大小计算**：文件夹本身不存储 `size`。动态计算文件夹大小时，通过数据库递归查询所有子文件的 `size` 总和，避免了在 R2 中进行昂贵的 `List Objects` 操作。

---

## 4. 为什么这样设计？ (架构对比)

| 维度 | 方案 A: 纯 R2 路径模拟 (`key="a/b/c.jpg"`) | 方案 B: D1 元数据驱动 (本项目采用) |
| :--- | :--- | :--- |
| **空文件夹** | 不支持 (必须有文件路径才存在) | **完美支持** (数据库存一条 folder 记录) |
| **重命名/移动** | 极慢 (需 Copy + Delete 所有对象) | **极快** (仅修改数据库一列) |
| **元数据扩展** | 极难 (Key 长度有限) | **简单** (直接增加数据库字段，如星标、标签) |
| **性能** | 受限于对象存储的 List 速度 | **极快** (依赖 SQL 索引) |

### 结论
对于一个**现代化网盘**，数据库元数据是不可或缺的。它提供了对象存储所缺失的“文件系统灵活性”，是实现回收站、秒传、版本控制、细粒度权限等高级功能的基石。
