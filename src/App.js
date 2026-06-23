import { useState } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
const [stage, setStage] = useState("ابتدائي");
const [grade, setGrade] = useState("الأول الابتدائي");
const [subject, setSubject] = useState("الرياضيات");
const [examType, setExamType] = useState("نهائي");

const [mcqCount, setMcqCount] = useState(10);
const [tfCount, setTfCount] = useState(5);
const [matchCount, setMatchCount] = useState(5);
const [fillCount, setFillCount] = useState(5);
const [essayCount, setEssayCount] = useState(3);

const [fromPage, setFromPage] = useState("");
const [toPage, setToPage] = useState("");

  const API_KEY = "AQ.Ab8RN6KKIz0KZSZpTcCYX8fo7NHGoTuVKurfHujMYZCI5VXuHA";

  const generateExam = async () => {
    setLoading(true);
    setResult("");

    try {
      const prompt = `
أنت معلم سعودي خبير.

قم بإنشاء اختبار مدرسي كامل منظم يشمل:

- اختيار من متعدد (4 خيارات لكل سؤال)
- صح أو خطأ
- أكمل الفراغ
- أسئلة مقالية قصيرة

المطلوب:
- اختبار كامل منسق
- مناسب لطلاب المدارس السعودية
- واضح ومنظم

المادة: رياضيات
المرحلة: متوسط
      `;

const res = await fetch(
"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    API_KEY,

  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    }),
  }
);

      const data = await res.json();
console.log(data);
alert(JSON.stringify(data));

      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "لم يتم توليد اختبار";

      setResult(text);
    } catch (error) {
      setResult("حدث خطأ في الاتصال بالذكاء الاصطناعي");
    }

    setLoading(false);
  };

  return (
    <div dir="rtl" style={{ fontFamily: "Arial", background: "#f4f6f8", minHeight: "100vh" }}>

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(90deg,#0f9d58,#34a853)",
        color: "white",
        padding: "25px",
        textAlign: "center"
      }}>
        <h1>🏫 منشئ الاختبارات السعودية</h1>
        <p>نظام ذكي لتوليد الاختبارات لجميع المواد</p>
      </div>

      {/* BODY */}
      <div style={{ padding: "20px", maxWidth: "900px", margin: "auto" }}>

        {/* UPLOAD */}
        <div style={card}>
          <h3>📘 رفع الكتاب</h3>

          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setFile(e.target.files[0])}
          />

          {file && <p>📄 {file.name}</p>}
        </div>
<div style={card}>
  <h3>🎓 بيانات الاختبار</h3>

  <p>المرحلة الدراسية</p>
  <select value={stage} onChange={(e) => setStage(e.target.value)}>
    <option>ابتدائي</option>
    <option>متوسط</option>
    <option>ثانوي</option>
  </select>

  <p>الصف الدراسي</p>
  <select value={grade} onChange={(e) => setGrade(e.target.value)}>
    <option>الأول الابتدائي</option>
    <option>الثاني الابتدائي</option>
    <option>الثالث الابتدائي</option>
    <option>الرابع الابتدائي</option>
    <option>الخامس الابتدائي</option>
    <option>السادس الابتدائي</option>
    <option>الأول المتوسط</option>
    <option>الثاني المتوسط</option>
    <option>الثالث المتوسط</option>
    <option>الأول الثانوي</option>
    <option>الثاني الثانوي</option>
    <option>الثالث الثانوي</option>
  </select>

  <p>المادة الدراسية</p>
  <select value={subject} onChange={(e) => setSubject(e.target.value)}>
    <option>الرياضيات</option>
    <option>لغتي</option>
    <option>العلوم</option>
    <option>الدراسات الاجتماعية</option>
    <option>اللغة الإنجليزية</option>
    <option>المهارات الرقمية</option>
    <option>التربية الفنية</option>
    <option>التربية البدنية</option>
    <option>المهارات الحياتية والأسرية</option>
    <option>التوحيد</option>
    <option>الفقه</option>
    <option>الحديث</option>
    <option>التفسير</option>
    <option>التجويد</option>
    <option>القرآن الكريم</option>
  </select>

  <p>نوع الاختبار</p>
  <select value={examType} onChange={(e) => setExamType(e.target.value)}>
    <option>نهائي</option>
    <option>منتصف الفصل</option>
    <option>تشخيصي</option>
    <option>قصير</option>
    <option>واجب</option>
  </select>

  <p>من صفحة</p>
  <input
    type="number"
    value={fromPage}
    onChange={(e) => setFromPage(e.target.value)}
  />

  <p>إلى صفحة</p>
  <input
    type="number"
    value={toPage}
    onChange={(e) => setToPage(e.target.value)}
  />
</div>

<div style={card}>
  <h3>📝 توزيع الأسئلة</h3>

  <p>اختيار من متعدد</p>
  <input
    type="number"
    value={mcqCount}
    onChange={(e) => setMcqCount(e.target.value)}
  />

  <p>صح أو خطأ</p>
  <input
    type="number"
    value={tfCount}
    onChange={(e) => setTfCount(e.target.value)}
  />

  <p>صل</p>
  <input
    type="number"
    value={matchCount}
    onChange={(e) => setMatchCount(e.target.value)}
  />

  <p>أكمل الفراغ</p>
  <input
    type="number"
    value={fillCount}
    onChange={(e) => setFillCount(e.target.value)}
  />

  <p>مقالي</p>
  <input
    type="number"
    value={essayCount}
    onChange={(e) => setEssayCount(e.target.value)}
  />
</div>


        {/* BUTTON */}
        <button
          onClick={generateExam}
          style={{
            width: "100%",
            padding: "15px",
            background: "#0f9d58",
            color: "white",
            border: "none",
            borderRadius: "10px",
            fontSize: "16px",
            cursor: "pointer"
          }}
        >
          🚀 إنشاء الاختبار
        </button>

        {loading && <p>⏳ جاري توليد الاختبار...</p>}

        {result && (
          <div style={card}>
            <pre style={{ whiteSpace: "pre-wrap" }}>{result}</pre>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{
        background: "#222",
        color: "white",
        textAlign: "center",
        padding: "20px",
        marginTop: "30px"
      }}>
        <p>© Mohammed ALSOUFI</p>
        <p>📞 772317005</p>
        <p>✉️ mohammed652824@gmail.com</p>
      </div>
    </div>
  );
}

const card = {
  background: "white",
  padding: "15px",
  borderRadius: "10px",
  marginBottom: "15px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
};




