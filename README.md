# Big AI Sdn Bhd — 员工请假与考勤管理系统

基于 **Next.js 16 + Supabase + Tailwind CSS 4 + shadcn/ui** 构建的完整考勤与请假管理系统。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + TypeScript |
| 样式 | Tailwind CSS 4 + shadcn/ui（蓝色主题）|
| 后端/数据库 | Supabase (Postgres + Auth + RLS + Storage) |
| 时区 | Asia/Kuala_Lumpur (UTC+8) |
| 部署 | Vercel |

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.local.example .env.local
```

填写 `.env.local` 中的 Supabase 配置：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. 设置 Supabase 数据库

在 Supabase Dashboard → SQL Editor 中依次执行：

```sql
-- 1. 建表、枚举、索引
\i supabase/migrations/001_schema.sql

-- 2. 业务函数（天数计算、年假额度、年度生成）
\i supabase/migrations/002_functions.sql

-- 3. 行级安全策略（RLS）
\i supabase/migrations/003_rls.sql

-- 4. 自动化触发器（审批流、打卡状态）
\i supabase/migrations/004_triggers.sql

-- 5. 种子测试数据（可选）
\i supabase/seed.sql
```

### 4. 创建 Supabase Storage Bucket

在 Supabase Dashboard → Storage 中：
1. 创建 Bucket: `leave-attachments`
2. 设置为 **Public**（或配置 RLS）
3. 文件大小限制：5MB
4. 允许类型：image/jpeg, image/png, application/pdf

### 5. 创建测试用户

在 Supabase Dashboard → Authentication → Users 中为种子数据的5名员工创建账号：

| 邮箱 | 密码（建议）| 员工编号 |
|------|------------|----------|
| tanweiming@bigai.com.my | Test@123 | EMP001 |
| siti@bigai.com.my | Test@123 | EMP002 |
| rajesh@bigai.com.my | Test@123 | EMP003 |
| limmeiling@bigai.com.my | Test@123 | EMP004 |
| ahmad@bigai.com.my | Test@123 | EMP005 |

创建后，更新 `employees` 表的 `auth_user_id` 字段：

```sql
UPDATE employees SET auth_user_id = '...' WHERE employee_code = 'EMP001';
-- 以此类推
```

### 6. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 功能模块

### 员工端
| 路由 | 功能 |
|------|------|
| `/dashboard` | 假期余额卡片、考勤概览、快捷打卡 |
| `/attendance` | 上班/下班打卡（GPS 可选）、月历视图 |
| `/leave/apply` | 申请假期（实时天数计算、MC 附件上传）|
| `/leave/history` | 假期历史记录（可取消待审批申请）|
| `/leave/calendar` | 团队假期日历（部门内成员请假可视化）|

### 经理端
| 路由 | 功能 |
|------|------|
| `/manager/approvals` | 审批中心（批准/拒绝/批量审批）|
| `/manager/team` | 团队出勤率、假期余额概览 |

### HR 管理端
| 路由 | 功能 |
|------|------|
| `/admin/employees` | 员工管理（搜索、筛选、编辑）|
| `/admin/holidays` | 公共假期管理（联邦 + 州属）|
| `/admin/reports` | 月度报表 + CSV 导出（UTF-8 BOM）|
| `/admin/settings` | 工作时间、GPS、结转政策配置 |

---

## 数据库结构

```
employees          → 员工基本信息
leave_types        → 假期类型 (AL/MC/EL/UL)
leave_entitlements → 年度假期额度（含余额 generated column）
leave_requests     → 请假申请
attendance_records → 打卡记录（含工时 generated column）
public_holidays    → 公共假期（联邦 + 州属）
overtime_records   → 加班记录
```

### 关键自动化
- **余额同步**：触发器自动处理 pending_days ↔ used_days 转换
- **迟到判断**：触发器自动根据 9:15 KL 时间判断 late/present
- **工时计算**：`work_hours` generated column 自动计算
- **余额计算**：`balance` generated column = entitled + carried_forward - used - pending

---

## 角色权限

| 角色 | 权限 |
|------|------|
| `employee` | 读写自己的考勤、请假 |
| `manager` | 员工权限 + 查看/审批下属申请 |
| `hr_admin` | 全系统读写权限 |

---

## 假期类型（马来西亚 Employment Act 1955）

| 代码 | 名称 | 额度 | 备注 |
|------|------|------|------|
| AL | 年假 | 8/12/16 天（按年资）| 结转上限 5 天 |
| MC | 病假 | 14 天 | >2天须上传医疗证明 |
| EL | 紧急假 | 2 天 | 可事后48小时内补申 |
| UL | 无薪假 | 无限制 | 需审批 |

---

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 导入项目
3. 添加环境变量（与 `.env.local` 相同）
4. 在 Supabase Dashboard → Auth → URL Configuration 中：
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/auth/callback`
5. 部署完成

---

## 开发命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run lint     # ESLint 检查
```
