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

// ========================================================
// 🔄 [تحديث] مصفوفة المفاتيح الذكية لتخطي حظر الحصة اليومية 429
// ========================================================
const API_KEYS = [
    "AQ.Ab8RN6JbilqRzvWjh3pG9jAOajCGt0LVndZOCC4clFx57GYs3Q",
    "AQ.Ab8RN6KbjH1l0imm6o_vcaBbOYWBjYMQfY8XAFnOpf744plffA",
    "AQ.Ab8RN6Jl1mbWR1pTBN6kqUuB6AmdX5fA8cNnCcvhgstiodKPNg"
];
let currentKeyIndex = 0; // المؤشر الافتراضي للبدء بالمفتاح الأول

// ========================================================
// تعريف الهيكل الصارم (Schema) لإجبار Gemini عليه
// ========================================================
const rigidExamSchema = {
    type: "OBJECT",
    properties: {
        exam_title: { type: "STRING" },
        instructions: { type: "STRING" },
        sections: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    section_title: { type: "STRING" },
                    type: { 
                        type: "STRING", 
                        description: "Must be exactly one of: multiple_choice, true_false, matching, fill_in_the_blank, short_answer" 
                    },
                    questions: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                id: { type: "INTEGER" },
                                question: { type: "STRING" },
                                options: { 
                                    type: "ARRAY", 
                                    items: { type: "STRING" }, 
                                    description: "Strictly 4 text choices. Used only when type is multiple_choice" 
                                },
                                left_item: { 
                                    type: "STRING", 
                                    description: "Item from column A. Used only when type is matching" 
                                },
                                right_item: { 
                                    type: "STRING", 
                                    description: "The matching correct item from column B. Used only when type is matching" 
                                }
                            },
                            required: ["id", "question"]
                        }
                    }
                },
                required: ["section_title", "type", "questions"]
            }
        }
    },
    required: ["exam_title", "instructions", "sections"]
};

// =======================
// دوال مساعدة لقراءة الفهرس
// =======================
function getCurriculumFile(semester) {
    if (semester === "الفصل الثاني" || semester === "الفصل الدراسي الثاني") {
        return "curriculum_f2.txt";
    }
    return "curriculum_f1.txt";
}

function getCurriculumContent(fileName) {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8");
}

function getCurriculumIndex(grade, subject, semester) {
    const fileName = getCurriculumFile(semester);
    const content = getCurriculumContent(fileName);
    if (!content) return "";

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
                result.push(line.replace("### مادة: ", "").trim());
                continue;
            }
            if (capture === "subject" && line.startsWith("### مادة:")) break;
            if (capture === "subject" && line.trim() !== "") {
                result.push(line.trim());
            }
        }
    }
    return result.join("\n");
}

// ========================================================
// GEMINI FUNCTION (المحدثة بالكامل لتدوير المفاتيح تلقائياً)
// ========================================================
async function callGemini(prompt) {
    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: rigidExamSchema,
            temperature: 0.2
        }
    });

    // محاولة الاتصال عبر الحلقات التكرارية مع إمكانية تبديل المفتاح
    for (let i = 0; i < 5; i++) {
        // اختيار المفتاح النشط حالياً بناءً على المؤشر
        const ACTIVE_KEY = API_KEYS[currentKeyIndex];
        console.log(`🔑 استخدام المفتاح رقم [${currentKeyIndex + 1}] لإرسال الطلب...`);

        // العودة إلى الموديل الأساسي كما كان من قبل مع الاحتفاظ بالمفتاح النشط تلقائياً
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${ACTIVE_KEY}`;


        try {
            const data = await new Promise((resolve, reject) => {
                const req = https.request(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Content-Length": Buffer.byteLength(requestBody),
                    },
                }, (res) => {
                    let body = "";
                    res.on("data", (chunk) => (body += chunk));
                    res.on("end", () => {
                        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
                    });
                });
                req.on("error", (e) => reject(e));
                req.write(requestBody);
                req.end();
            });

            if (data?.candidates?.length) {
                return data.candidates[0].content.parts[0].text;
            }

            if (data?.error) {
                console.log(`❌ خطأ من جوميني (كود ${data.error.code}):`, data.error.message);
                
                // إذا نفدت الحصة (429)، قم بتغيير المفتاح فوراً للمحاولة القادمة
                if (data.error.code === 429) {
                    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
                    console.log(`🔄 ⚠️ نفدت حصة المفتاح الحالي! تم التدوير والتحول تلقائياً للمفتاح رقم [${currentKeyIndex + 1}]`);
                    await new Promise(r => setTimeout(r, 2000)); // انتظار بسيط قبل الإعادة
                    continue;
                }
            }
            console.log("استجابة فارغة، إعادة المحاولة...");
        } catch (e) {
            console.log("خطأ في الاتصال بالأصل:", e.message);
        }
        await new Promise(r => setTimeout(r, 4000));
    }
    throw new Error("فشلت جميع المفاتيح المتاحة في توليد الاختبار بسبب نفاد الحصص العامة.");
}

// =======================
// API: الحصول على المواد
// =======================
app.get("/subjects", (req, res) => {
    const grade = req.query.grade || "";
    const semester = req.query.semester || "الفصل الأول";
    const fileName = getCurriculumFile(semester);
    const content = getCurriculumContent(fileName);

    if (!content) {
        return res.json({ subjects: [] });
    }

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


// =======================
// API: الحصول على وحدات المادة
// =======================
app.get("/topics", (req, res) => {
    const grade = req.query.grade || "";
    const subject = req.query.subject || "";
    const semester = req.query.semester || "الفصل الأول";

    const curriculum = getCurriculumIndex(grade, subject, semester);
    if (!curriculum) {
        return res.json({ topics: [] });
    }

    const lines = curriculum.split("\n");
    const topics = lines.filter(line => line.trim() !== "").map(line => line.trim());
    res.json({ topics });
});

// =======================
// API: توليد الاختبار
// =======================
app.post("/generate", upload.single("file"), async (req, res) => {
    console.log("📩 Request received");

    try {
        let text = "";
        if (req.file) {
            const dataBuffer = fs.readFileSync(req.file.path);
            try {
                const pdfData = await pdfParse(dataBuffer);
                text = (pdfData.text || "").trim();
            } catch (e) {
                console.log("PDF error:", e.message);
            }
        }

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

        const curriculum = getCurriculumIndex(grade, subject, semester);

        let prompt = "";
        if (text && text.length > 50) {
            prompt = `أنت خبير مناهج سعودي. استخرج من النص التالي اختباراً لـ${subject} للصف ${grade}، ${semester}.\n${curriculum ? `\n📋 الفهرس:\n${curriculum}\n` : ""}\nالنص: ${text}`;
        } else {
            prompt = `أنت خبير مناهج سعودي. قم ببناء اختبار ${examType} لمادة ${subject} للصف ${grade}، ${semester}.\n${curriculum ? `\n📋 الفهرس:\n${curriculum}\n` : ""}\nالوحدات: ${topic}`;
        }

        prompt += `\n\n📊 المطلوب تحضيره من الأسئلة بدقة:
- ${mcqCount} اختيار من متعدد (نوع: multiple_choice)
- ${tfCount} صح/خطأ (نوع: true_false)
- ${matchCount} توصيل عمودين (نوع: matching)
- ${fillCount} إكمال الفراغ (نوع: fill_in_the_blank)
- ${essayCount} أسئلة مقالية (نوع: short_answer)

🚨 تعليمات صارمة لبنية الـ JSON:
1. يجب الالتزام الكامل بالأسماء المفتاحية الإنجليزية الواردة في الـ Schema.
2. في أسئلة (multiple_choice): مصفوفة options يجب أن تشتمل على نصوص الاختيارات الأربعة فقط (بدون حروف مثل أ، ب، ج).
3. في أسئلة التوصيل (matching): لكل عنصر، ضع نص العبارة الأساسية في حقل left_item، وضع النص المطابق والصحيح المقابل له في حقل right_item مباشرة.
4. لا تترجم مفاتيح الـ JSON إلى لغة عربية أبداً.`;

        console.log("🚀 Sending to Gemini with Keys Rotation Strategy...");
        const result = await callGemini(prompt);
        return res.json({ result });

    } catch (err) {
        console.error("❌ SERVER ERROR:", err);
        return res.status(500).json({ error: err.message });
    }
});

// ========================================================
// API: تحميل Word (مع حقن المتغيرات للترويسة والترقيم)
// ========================================================
app.post("/download-word", (req, res) => {
    try {
        let { result } = req.body;
        if (!result) {
            return res.status(400).json({ error: "لا يوجد نص" });
        }

        let cleanText = result.replace(/```json|```/g, "").trim();

        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(400).json({ error: "بنية JSON غير موجودة" });
        }
        cleanText = jsonMatch[0];

        let jsonData;
        try {
            jsonData = JSON.parse(cleanText);
        } catch (e) {
            console.error("فشل تحليل JSON:", e.message);
            return res.status(400).json({ error: "تنسيق JSON غير صالح" });
        }

        // ========================================================
        // تحويل الأقسام وحقن قيم الواجهة الفورية (المادة، الصف، الفصل)
        // ========================================================
        let convertedData = {
            title: jsonData.exam_title || "اختبار نهائي",
            instructions: jsonData.instructions || "",
            subject: req.body.subject || "", 
            grade: req.body.grade || "",
            semester: req.body.semester || "",
            multiple_choice: [],
            true_false: [],
            matching: [],
            fill_blank: [],
            essay: []
        };

        if (jsonData.sections && Array.isArray(jsonData.sections)) {
            for (const section of jsonData.sections) {
                const type = (section.type || "").toString().toLowerCase().trim();
                const questions = section.questions || [];

                if (type === "multiple_choice") {
                    questions.forEach((q, idx) => {
                        const opts = {};
                        if (Array.isArray(q.options)) {
                            const letters = ["أ", "ب", "ج", "د"];
                            q.options.forEach((opt, oIdx) => {
                                if (letters[oIdx]) opts[letters[oIdx]] = opt;
                            });
                        }
                        convertedData.multiple_choice.push({
                            id: (idx + 1), 
                            question: q.question || "",
                            options: opts
                        });
                    });
                } 
                else if (type === "true_false") {
                    questions.forEach((q, idx) => {
                        convertedData.true_false.push({
                            id: (idx + 1), 
                            question: q.question || ""
                        });
                    });
                } 
                else if (type === "matching") {
                    const columnA = [];
                    const columnB = [];
                    
                    questions.forEach(q => {
                        if (q.left_item) columnA.push(q.left_item);
                        if (q.right_item) columnB.push(q.right_item);
                    });

                    convertedData.matching.push({
                        id: 1, 
                        column_a: columnA,
                        column_b: columnB // سيتم تدويرها وخلطها داخل ملف الوورد تلقائياً
                    });
                } 
                else if (type === "fill_in_the_blank") {
                    questions.forEach((q, idx) => {
                        convertedData.fill_blank.push({
                            id: (idx + 1),
                            question: q.question || ""
                        });
                    });
                } 
                else if (type === "short_answer") {
                    questions.forEach((q, idx) => {
                        convertedData.essay.push({
                            id: (idx + 1),
                            question: q.question || ""
                        });
                    });
                }
            }
        }

        const doc = createExamDoc(convertedData);
        if (!doc) {
            return res.status(400).json({ error: "تنسيق غير صالح" });
        }

        Packer.toBuffer(doc).then(buffer => {
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.setHeader("Content-Disposition", "attachment; filename=exam.docx");
            res.send(buffer);
        }).catch(err => {
            console.error("Packer error:", err);
            res.status(500).json({ error: "فشل إنشاء الملف" });
        });

    } catch (e) {
        console.error("DOWNLOAD ERROR:", e);
        res.status(500).json({ error: e.message });
    }
});

// =======================
// بدء الخادم
// =======================
app.use(express.static(path.join(__dirname, "../dist")));
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});
app.listen(3001, "0.0.0.0", () => console.log( "Server running on port 3001"));

