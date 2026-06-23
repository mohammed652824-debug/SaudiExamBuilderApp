const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { createExamDoc } = require("./examTemplate");
const { Packer } = require("docx");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// ⚠️ استبدل هذا بمفتاح API الخاص بك
const API_KEY = "AQ.Ab8RN6JbilqRzvWjh3pG9jAOajCGt0LVndZOCC4clFx57GYs3Q";

// =======================
// دالة قراءة الفهرس من الملف
// =======================
function getCurriculumIndex(grade, subject, semester) {
    let fileName = "curriculum_f1.txt";
    if (semester === "الفصل الثاني" || semester === "الفصل الدراسي الثاني") {
        fileName = "curriculum_f2.txt";
    }

    const filePath = path.join(__dirname, fileName);

    if (!fs.existsSync(filePath)) {
        console.log("⚠️ ملف الفهرس غير موجود:", fileName);
        return "";
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    let capture = false;
    let result = [];

    for (const line of lines) {
        if (line.startsWith(`## الصف: ${grade}`)) {
            capture = true;
            continue;
        }
        if (capture) {
            if (line.startsWith("## الصف:")) break;
            if (line.startsWith(`### مادة: ${subject}`)) {
                capture = "subject";
                result.push(line.replace("### مادة: ", "المادة: "));
                continue;
            }
            if (capture === "subject" && line.startsWith("### مادة:")) break;
            if (capture === "subject" && line.trim() !== "") {
                result.push(line.trim());
            }
        }
    }

    if (result.length === 0) {
        console.log("⚠️ لم يتم العثور على فهرس للمادة:", subject, "الصف:", grade);
        return "";
    }

    console.log("✅ تم العثور على الفهرس للمادة:", subject);
    return result.join("\n");
}

// =======================
// GEMINI FUNCTION
// =======================
async function callGemini(prompt) {
    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    for (let i = 0; i < 3; i++) {
        try {
            const data = await new Promise((resolve, reject) => {
                const req = https.request(
                    url,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Content-Length": Buffer.byteLength(requestBody),
                        },
                    },
                    (res) => {
                        let body = "";
                        res.on("data", (chunk) => (body += chunk));
                        res.on("end", () => {
                            try {
                                resolve(JSON.parse(body));
                            } catch (e) {
                                reject(new Error("Failed to parse response"));
                            }
                        });
                    }
                );

                req.on("error", (e) => reject(e));
                req.write(requestBody);
                req.end();
            });

            console.log("Gemini response:", JSON.stringify(data).slice(0, 200));

            if (data?.candidates?.length) {
                return data.candidates[0].content.parts[0].text;
            }

            if (data?.error) {
                console.log("Gemini API error:", data.error);
                if (data.error.code === 429) {
                    const retryDelay = (data.error.details?.[2]?.retryDelay || "60s").replace("s", "");
                    console.log(`⏳ حد يومي. الانتظار ${retryDelay} ثانية...`);
                    await new Promise((r) => setTimeout(r, parseInt(retryDelay) * 1000));
                    continue;
                }
            }

            console.log("Empty response retry...");
        } catch (e) {
            console.log("Gemini error:", e.message);
        }

await new Promise((r) => setTimeout(r, 5000));
    }

    throw new Error("Gemini failed");
}

// =======================
// MAIN API
// =======================
app.post("/generate", upload.single("file"), async (req, res) => {
    console.log("📩 Request received");

    try {
        let text = "";

        // إذا فيه ملف PDF مرفوع
        if (req.file) {
            const dataBuffer = fs.readFileSync(req.file.path);
            try {
                const pdfData = await pdfParse(dataBuffer);
                text = (pdfData.text || "").trim();
            } catch (e) {
                console.log("PDF error:", e.message);
            }
            console.log("PDF TEXT LENGTH:", text.length);
        } else {
            console.log("📝 NO FILE - Generating from knowledge");
        }

        // قراءة المدخلات من الواجهة
        const stage = req.body.stage || "متوسط";
        const grade = req.body.grade || "الأول المتوسط";
        const subject = req.body.subject || "الرياضيات";
        const examType = req.body.examType || "نهائي";
        const semester = req.body.semester || "الفصل الأول";
        const topic = req.body.topic || "";
        const mcqCount = req.body.mcqCount || 10;
        const tfCount = req.body.tfCount || 5;
        const matchCount = req.body.matchCount || 3;
        const fillCount = req.body.fillCount || 3;
        const essayCount = req.body.essayCount || 3;
        const fromPage = req.body.fromPage || "";
        const toPage = req.body.toPage || "";

        console.log("STAGE:", stage, "| GRADE:", grade, "| SUBJECT:", subject, "| SEMESTER:", semester);

        // جلب الفهرس
        const curriculum = getCurriculumIndex(grade, subject, semester);
        console.log("INDEX FOUND:", curriculum ? `YES (${curriculum.length} chars)` : "NO");

        // بناء البرومبت
        let prompt = "";

        if (text && text.length > 50) {
            // مع PDF
            prompt = `
أنت خبير مناهج واختبارات في وزارة التعليم السعودية.

قم ببناء اختبار ${examType} احترافي لمادة **${subject}** للصف **${grade}** في المرحلة **${stage}** - ${semester}.

${curriculum ? `\n📋 الفهرس الرسمي للمادة:\n${curriculum}\n` : ""}

🚨 القواعد:
1- استخرج الأسئلة من النص المرفق فقط، مع مراعاة الفهرس أعلاه.
2- أعد صياغة الفكرة، لا تنسخ الجمل.
3- الأسئلة مباشرة ومناسبة للطالب.
4- راعِ مستويات التفكير: تذكر 30%، فهم 40%، تطبيق وتحليل 30%.

────────────────────────────
📊 المطلوب (${semester}):
────────────────────────────
- ${mcqCount} أسئلة اختيار من متعدد (4 خيارات)
- ${tfCount} أسئلة صح أو خطأ
- ${matchCount} أسئلة صل العبارة الصحيحة
- ${fillCount} أسئلة أكمل الفراغ
- ${essayCount} أسئلة مقالية قصيرة
- مفتاح الإجابة

────────────────────────────
📘 النص:
${text.slice(0, 4000)}
────────────────────────────
${fromPage && toPage ? `الصفحات المطلوبة: من ${fromPage} إلى ${toPage}` : ""}
${topic ? `الموضوع المحدد: ${topic}` : ""}

📦 أخرج النتيجة بصيغة JSON بهذا الشكل:
{
  "title": "اختبار ${subject} - ${grade}",
  "stage": "${stage}",
  "grade": "${grade}",
  "subject": "${subject}",
  "examType": "${examType}",
  "semester": "${semester}",
  "multiple_choice": [],
  "true_false": [],
  "matching": [],
  "fill_blank": [],
  "essay": [],
  "answer_key": {
    "multiple_choice": [],
    "true_false": [],
    "matching": [],
    "fill_blank": [],
    "essay": []
  }
}
`;
        } else {
            // بدون PDF
            prompt = `
أنت خبير مناهج واختبارات في وزارة التعليم السعودية. أنت تعرف منهج **${subject}** للصف **${grade}** في المرحلة **${stage}** - ${semester} معرفة كاملة.

قم ببناء اختبار ${examType} احترافي كأنك تضع اختباراً وزارياً حقيقياً.

${curriculum ? `\n📋 الفهرس الرسمي للمادة:\n${curriculum}\n` : ""}

🚨 القواعد:
1- التزم بمنهج الصف ${grade} - مادة ${subject} - ${semester}.
2- الأسئلة مباشرة ومناسبة لمستوى الطالب في هذا الصف.
3- راعِ مستويات التفكير: تذكر 30%، فهم 40%، تطبيق وتحليل 30%.
4- يجب أن تكون الأسئلة باللغة العربية الفصحى الواضحة.
5- لا تكرر نفس الفكرة.

────────────────────────────
📊 المطلوب (${semester}):
────────────────────────────
- ${mcqCount} أسئلة اختيار من متعدد (أ، ب، ج، د)
- ${tfCount} أسئلة صح (✓) أو خطأ (✗)
- ${matchCount} أسئلة صل العبارة في العمود (أ) بما يناسبها في العمود (ب)
- ${fillCount} أسئلة أكمل الفراغ
- ${essayCount} أسئلة مقالية قصيرة
- مفتاح الإجابة الكامل

────────────────────────────
${topic ? `🎯 الموضوع المحدد: ${topic}` : "🎯 غطِّ أهم مواضيع المقرر في هذا الاختبار."}
────────────────────────────
${fromPage && toPage ? `📄 نطاق الصفحات: من ${fromPage} إلى ${toPage}` : ""}

📦 أخرج النتيجة بصيغة JSON فقط وبدون أي نص إضافي:
{
  "title": "اختبار ${subject} - ${grade} - ${examType}",
  "stage": "${stage}",
  "grade": "${grade}",
  "subject": "${subject}",
  "examType": "${examType}",
  "semester": "${semester}",
  "instructions": "تعليمات الاختبار...",
  "multiple_choice": [
    {"id": 1, "question": "...", "options": {"أ": "...", "ب": "...", "ج": "...", "د": "..."}}
  ],
  "true_false": [
    {"id": 1, "question": "..."}
  ],
  "matching": [
    {"id": 1, "question": "صل العبارة...", "column_a": ["..."], "column_b": ["..."]}
  ],
  "fill_blank": [
    {"id": 1, "question": "..."}
  ],
  "essay": [
    {"id": 1, "question": "..."}
  ],
  "answer_key": {
    "multiple_choice": [{"id": 1, "answer": "أ"}],
    "true_false": [{"id": 1, "answer": true}],
    "matching": [{"id": 1, "answer": "1-ج"}],
    "fill_blank": [{"id": 1, "answer": "الكلمة الصحيحة"}],
    "essay": [{"id": 1, "model_answer": "..."}]
  }
}
`;
        }

        console.log("🚀 Sending to Gemini...");
        const result = await callGemini(prompt);

        return res.json({ result });

    } catch (err) {
        console.error("❌ SERVER ERROR:", err);
        return res.status(500).json({ error: err.message });
    }
});

// =======================
// SERVER START
// =======================
app.get("/", (req, res) => {
    res.send("Server is working 🚀");
});

// =======================
// API لجلب الوحدات
// =======================
app.get("/topics", (req, res) => {
    const grade = req.query.grade || "";
    const subject = req.query.subject || "";
    const semester = req.query.semester || "الفصل الأول";

    const curriculum = getCurriculumIndex(grade, subject, semester);

    if (!curriculum) {
        return res.json({ topics: [] });
    }

    // استخراج أسماء الوحدات أو الفصول فقط
    const lines = curriculum.split("\n");
    const topics = lines
        .filter(line => line.trim() !== "" && line.trim().startsWith("المادة:"))
        .map(line => line.replace("المادة: ", ""));

    // إذا لم تكن هناك وحدات، أرجع كل الأسطر
    if (topics.length === 0) {
        const allTopics = lines
            .filter(line => line.trim() !== "")
            .map(line => line.trim());
        return res.json({ topics: allTopics });
    }

    return res.json({ topics });
});
// =======================
// API تحميل Word
// =======================
app.post("/download-word", (req, res) => {
    try {
        let data = req.body.result;
        if (!data) return res.status(400).json({ error: "لا توجد بيانات" });

        // تحويل النص إلى JSON إذا كان نصاً
        if (typeof data === "string") {
            try {
                // تنظيف النص من علامات markdown
                let cleanData = data.replace(/```json|```/g, "").trim();
                data = JSON.parse(cleanData);
            } catch (e) {
                console.log("فشل تحويل النتيجة إلى JSON، استخدام النص كما هو");
                data = { title: "اختبار", essay: [{ id: 1, question: data }] };
            }
        }

        const doc = createExamDoc(data);
        if (!doc) return res.status(400).json({ error: "تنسيق غير صالح" });

        Packer.toBuffer(doc).then((buffer) => {
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.setHeader("Content-Disposition", "attachment; filename=exam.docx");
            res.send(buffer);
        }).catch(err => {
            console.error("خطأ في إنشاء الملف:", err);
            res.status(500).json({ error: "فشل إنشاء الملف" });
        });
    } catch (e) {
        console.error("DOWNLOAD ERROR:", e);
        res.status(500).json({ error: e.message });
    }
});

// =======================
// API لجلب المواد حسب الصف والفصل
// =======================
app.get("/subjects", (req, res) => {
    const grade = req.query.grade || "";
    const semester = req.query.semester || "الفصل الأول";

    let fileName = "curriculum_f1.txt";
    if (semester === "الفصل الثاني" || semester === "الفصل الدراسي الثاني") {
        fileName = "curriculum_f2.txt";
    }

    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) {
        return res.json({ subjects: [] });
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    let capture = false;
    const subjects = [];

    for (const line of lines) {
        if (line.startsWith(`## الصف: ${grade}`)) {
            capture = true;
            continue;
        }
        if (capture) {
            if (line.startsWith("## الصف:")) break;
            if (line.startsWith("### مادة:")) {
                const subjectName = line.replace("### مادة:", "").trim();
                if (!subjects.includes(subjectName)) {
                    subjects.push(subjectName);
                }
            }
        }
    }

    res.json({ subjects });
});
app.listen(3001, "0.0.0.0", () => {
    console.log("Server running on port 3001");
});







