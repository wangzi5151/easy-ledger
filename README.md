# 💰 Easy Ledger - 记账小助手

一款简洁美观的收支记账应用，帮助你轻松管理个人财务。

## 功能特性

### 💳 快速记账
- 收入/支出分类
- 8个常用分类（餐饮、交通、购物等）
- 金额输入与备注
- 一键保存

### 📊 详细统计
- 支出分类排行
- 7天支出趋势图
- 收支汇总分析
- 日均支出计算

### 🎯 预算管理
- 设置月度支出预算
- 实时预算使用情况
- 超支提醒

### 📋 明细查看
- 按日期分组显示
- 支持搜索备注和分类
- 删除功能

## 技术栈

- **前端**: 纯 HTML/CSS/JavaScript（零依赖）
- **构建工具**: Vite
- **Android 封装**: Capacitor 6
- **存储**: LocalStorage

## 安装与使用

### 直接使用
直接打开 `index.html` 即可在浏览器中使用。

### 构建 APK
```bash
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## 许可证

MIT License
