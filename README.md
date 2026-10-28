# Stoy

دردشة ومكالمات صوت/فيديو لمجموعة صغيرة (حتى 10 أشخاص) بأسلوب واتساب.

- محادثة جماعية + رسائل خاصة
- مكالمات صوت وفيديو (WebRTC)
- كلمة سر للغرفة، وحد أقصى 10 مستخدمين
- حفظ آخر 100 رسالة على القرص (تبقى بعد إعادة التشغيل)
- دعم TURN للشبكات الصارمة
- اعتماد واحد فقط: `ws`

## تشغيل محلي
```bash
npm install
ROOM_PASSWORD=كلمتك npm start   # http://localhost:3000
```

## النشر مع HTTPS (مطلوب للمكالمات خارج localhost)

**الخيار 1: Render (الأسهل).** ارفع المشروع إلى GitHub، ثم في Render اختر New → Blueprint واربط المستودع. سيقرأ `render.yaml` تلقائياً. أدخل `ROOM_PASSWORD`. الرابط يأتي بـ HTTPS جاهز. (القرص الدائم يحتاج خطة مدفوعة.)

**الخيار 2: خادمك الخاص (VPS).** يعطيك HTTPS + TURN + حفظ الرسائل:
```bash
cp .env.example .env     # عدّل DOMAIN و PUBLIC_IP وكلمات السر
docker compose up -d
```
وجّه سجل DNS للدومين إلى IP الخادم، وافتح المنافذ: 80، 443، 3478 (TCP/UDP)، و49160-49200 (UDP).

**الخيار 3: Railway / Fly.io.** يعملان مباشرة بفضل `Dockerfile`. اضبط المتغيرات من `.env.example` وأضف Volume على `/data`.

## متغيرات البيئة
| المتغير | الوصف |
|---|---|
| `ROOM_PASSWORD` | كلمة سر الغرفة (الافتراضي 1234) |
| `PORT` | المنفذ (الافتراضي 3000) |
| `DATA_DIR` | مجلد حفظ الرسائل (الافتراضي `./data`) |
| `TURN_URL` / `TURN_USER` / `TURN_PASS` | إعدادات خادم TURN (اختياري) |

## البنية
```
server.js          الخادم: ملفات + WebSocket + إشارات WebRTC + حفظ الرسائل
public/index.html  الواجهة
Dockerfile, render.yaml, docker-compose.yml, Caddyfile   النشر
```

MIT License
