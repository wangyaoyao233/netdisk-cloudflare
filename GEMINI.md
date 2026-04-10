# 项目概述
本项目实现的是基于cloudflare的个人网盘项目。
前端提供操作的UI，后端API使用cloudflare worker来实现。

## 技术栈
- 前端使用React+Vite来实现
- 后端使用Cloudflare的Worker部署，使用ts开发，会使用R2,D1等服务

## 项目架构
项目整体使用npm和npm自带的monorepo来实现对前后端的管理。
在安装包时，使用workspace推荐的最佳实践的方式。

## 对AI agent的要求
1. 每次打开AI agent时，不需要进行什么操作，等待我的指令。
2. 每次的修改和对应使用最佳实践的方式进行。
3. 每次执行完我的要求之后，将本次的对应更改，写入docs中的daily.md中。加入的内容格式如下：
```
## YYYY-MM-dd(修改的日期) {Summary}
### 背景

### 目标

### 采用的修改

### 结果

### 本次的最佳实践总结

### TODO(如果需要的话，一些将来可以做的事情)
```