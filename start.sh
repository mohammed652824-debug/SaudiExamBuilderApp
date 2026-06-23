#!/bin/bash
echo "🚀 بدء نظام توليد الاختبارات..."

# بدء الخادم
cd ~/SaudiExamBuilderApp/server
node index.js &

# بدء الـ Frontend
cd ~/SaudiExamBuilderApp
npm run dev
