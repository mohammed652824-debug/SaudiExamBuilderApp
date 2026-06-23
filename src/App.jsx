import { useState, useEffect } from "react";

const gradesByStage = {
  "ابتدائي": ["الأول الابتدائي", "الثاني الابتدائي", "الثالث الابتدائي", "الرابع الابتدائي", "الخامس الابتدائي", "السادس الابتدائي"],
  "متوسط": ["الأول المتوسط", "الثاني المتوسط", "الثالث المتوسط"],
  "ثانوي": ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"]
};

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [rawResult, setRawResult] = useState(null);
  const [stage, setStage] = useState("متوسط");
  const [grade, setGrade] = useState("الأول المتوسط");
  const [subject, setSubject] = useState("");
  const [examType, setExamType] = useState("نهائي");
  const [mcqCount, setMcqCount] = useState(10);
  const [tfCount, setTfCount] = useState(5);
  const [essayCount, setEssayCount] = useState(3);
  const [matchCount, setMatchCount] = useState(3);
  const [fillCount, setFillCount] = useState(3);
  const [semester, setSemester] = useState("الفصل الأول");
  const [availableTopics, setAvailableTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [fromPage, setFromPage] = useState("");
  const [toPage, setToPage] = useState("");

  const handleStageChange = (newStage) => {
    setStage(newStage);
    setGrade(gradesByStage[newStage][0]);
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:3001/subjects?grade=${encodeURIComponent(grade)}&semester=${encodeURIComponent(semester)}`);
      const data = await res.json();
      if (data.subjects && data.subjects.length > 0) {
        setAvailableSubjects(data.subjects);
        if (!data.subjects.includes(subject)) {
          setSubject(data.subjects[0]);
        }
      } else {
        setAvailableSubjects([]);
        setSubject("");
      }
    } catch (e) {
      console.log("Error fetching subjects:", e);
    }
  };

  const fetchTopics = async (selectedGrade, selectedSubject, selectedSemester) => {
    try {
      const res = await fetch(`http://127.0.0.1:3001/topics?grade=${encodeURIComponent(selectedGrade)}&subject=${encodeURIComponent(selectedSubject)}&semester=${encodeURIComponent(selectedSemester)}`);
      const data = await res.json();
      if (data.topics) {
        setAvailableTopics(data.topics);
        setSelectedTopic("");
      }
    } catch (e) {
      console.log("Error fetching topics:", e);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [grade, semester]);

  useEffect(() => {
    if (subject) {
      fetchTopics(grade, subject, semester);
    }
  }, [subject, semester]);

  const generateExam = async () => {
    setLoading(true);
    setResult("");

    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      formData.append("stage", stage);
      formData.append("grade", grade);
      formData.append("subject", subject);
      formData.append("examType", examType);
      formData.append("semester", semester);
      formData.append("matchCount", matchCount);
      formData.append("fillCount", fillCount);
      formData.append("topic", selectedTopic);
      formData.append("mcqCount", mcqCount);
      formData.append("tfCount", tfCount);
      formData.append("essayCount", essayCount);
      formData.append("fromPage", fromPage);
      formData.append("toPage", toPage);

      const res = await fetch("http://127.0.0.1:3001/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.error) {
        setResult("❌ " + data.error);
        setLoading(false);
        return;
      }
      setResult(data.result || "لا يوجد نتيجة");
      setRawResult(data.result);
    } catch (error) {
      console.error(error);
      setResult("حدث خطأ في الاتصال بالسيرفر");
    }
    setLoading(false);
  };

  const downloadWord = async () => {
    if (!rawResult) {
      alert("يرجى توليد الاختبار أولاً.");
      return;
    }
    try {
      const res = await fetch("http://127.0.0.1:3001/download-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: rawResult }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("خطأ: " + (err.error || "فشل التحميل"));
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "اختبار_وزاري.docx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("فشل تحميل الملف");
    }
  };

  return (
    <div dir="rtl" style={styles.container}>
      
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.logoContainer}>
          <span style={styles.headerIcon}>🏫</span>
          <h1 style={styles.headerTitle}>منشئ الاختبارات السعودية</h1>
        </div>
        <p style={styles.headerSubtitle}>نظام ذكي مؤتمت لتوليد الاختبارات لجميع المواد والصفوف</p>
      </header>

      {/* MAIN CONTAINER */}
      <div style={styles.mainContent}>
        
        {/* CARD 1: UPLOAD */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>📘</span>
            <h3 style={styles.cardTitle}>رفع الكتاب (اختياري)</h3>
          </div>
          <p style={styles.cardDescription}>يمكنك توليد اختبار بدون رفع ملف، أو اختيار ملف كتاب المادة هنا</p>
          
          <div style={styles.uploadBox}>
            <label style={styles.uploadLabel}>
              <span style={{ fontSize: "28px", marginBottom: "8px" }}>📄</span>
              <span style={{ color: "#0f9d58", fontWeight: "600" }}>
                {file ? file.name : "اضغط هنا لاختيار ملف الكتاب (PDF / DOCX)"}
              </span>
              <input type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={(e) => setFile(e.target.files[0])} />
            </label>
          </div>
        </div>

        {/* CARD 2: EXAM DATA */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>🎓</span>
            <h3 style={styles.cardTitle}>بيانات الاختبار الأساسية</h3>
          </div>
          
          <div style={styles.gridTwoColumns}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>المرحلة الدراسية</label>
              <select value={stage} onChange={(e) => handleStageChange(e.target.value)} style={styles.select}>
                <option>ابتدائي</option>
                <option>متوسط</option>
                <option>ثانوي</option>
              </select>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>الصف الدراسي</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} style={styles.select}>
                {gradesByStage[stage].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>المادة الدراسية</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} style={styles.select}>
                {availableSubjects.length > 0 ? (
                  availableSubjects.map(s => <option key={s} value={s}>{s}</option>)
                ) : (
                  <option value="">لا توجد مواد</option>
                )}
              </select>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>الفصل الدراسي</label>
              <select value={semester} onChange={(e) => setSemester(e.target.value)} style={styles.select}>
                <option>الفصل الأول</option>
                <option>الفصل الثاني</option>
              </select>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>نوع الاختبار</label>
              <select value={examType} onChange={(e) => setExamType(e.target.value)} style={styles.select}>
                <option>نهائي</option>
                <option>منتصف الفصل</option>
                <option>تشخيصي</option>
                <option>قصير</option>
                <option>واجب</option>
              </select>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>الوحدة الدراسية (اختياري)</label>
              <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} style={styles.select}>
                <option value="">كل الوحدات</option>
                {availableTopics.map((topic, index) => (
                  <option key={index} value={topic}>{topic}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* CARD 3: QUESTION DISTRIBUTION */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>📝</span>
            <h3 style={styles.cardTitle}>توزيع أعداد الأسئلة ونطاق الصفحات</h3>
          </div>

          <div style={styles.questionDistributionGrid}>
            <div style={styles.rowInput}>
              <div style={styles.rowLabelIcon}>❓ <span>اختيار من متعدد</span></div>
              <input type="number" value={mcqCount} onChange={(e) => setMcqCount(e.target.value)} style={styles.smallInput} />
            </div>

            <div style={styles.rowInput}>
              <div style={styles.rowLabelIcon}>✅ <span>صح أو خطأ</span></div>
              <input type="number" value={tfCount} onChange={(e) => setTfCount(e.target.value)} style={styles.smallInput} />
            </div>

            <div style={styles.rowInput}>
              <div style={styles.rowLabelIcon}>🔄 <span>صل العبارة الصحيحة</span></div>
              <input type="number" value={matchCount} onChange={(e) => setMatchCount(e.target.value)} style={styles.smallInput} />
            </div>

            <div style={styles.rowInput}>
              <div style={styles.rowLabelIcon}>📖 <span>أكمل الفراغ</span></div>
              <input type="number" value={fillCount} onChange={(e) => setFillCount(e.target.value)} style={styles.smallInput} />
            </div>

            <div style={styles.rowInput}>
              <div style={styles.rowLabelIcon}>✒️ <span>مقالي قصير</span></div>
              <input type="number" value={essayCount} onChange={(e) => setEssayCount(e.target.value)} style={styles.smallInput} />
            </div>
          </div>

          <div style={{ ...styles.gridTwoColumns, marginTop: "15px", borderTop: "1px dashed #ccc", paddingTop: "15px" }}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>من صفحة (اختياري)</label>
              <input type="number" value={fromPage} onChange={(e) => setFromPage(e.target.value)} style={styles.input} placeholder="مثال: 5" />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>إلى صفحة (اختياري)</label>
              <input type="number" value={toPage} onChange={(e) => setToPage(e.target.value)} style={styles.input} placeholder="مثال: 45" />
            </div>
          </div>
        </div>

        {/* MAIN BUTTON */}
        <button onClick={generateExam} style={styles.submitBtn} disabled={loading}>
          {loading ? "⏳ جاري صياغة وتوليد الاختبار..." : "🚀 إنشاء وتوليد الاختبار النهائي"}
        </button>

        {/* RESULTS PRESENTATION */}
        {result && (
          <div style={{ ...styles.card, marginTop: "20px" }}>
            <button onClick={downloadWord} style={styles.wordBtn}>
              📥 تحميل الاختبار كملف Word مُنسق
            </button>
            <h4 style={{ marginTop: "15px", marginBottom: "10px", color: "#333" }}>✨ معاينة مسودة الاختبار:</h4>
            <pre style={styles.preFormat}>{result}</pre>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <p style={{ margin: 0 }}>© جميع الحقوق محفوظة لـ Mohammed ALSOUFI</p>
        <p style={{ margin: "5px 0 0 0", opacity: 0.8 }}>✉️ mohammed652824@gmail.com</p>
      </footer>
    </div>
  );
}

// التنسيقات الآمنة والمستقرة تماماً
const styles = {
  container: { fontFamily: "Arial, sans-serif", background: "#f4f6f8", minHeight: "100vh", paddingBottom: "40px", color: "#333" },
  header: { background: "linear-gradient(90deg, #0f9d58, #34a853)", color: "white", padding: "35px 20px", textAlign: "center", borderBottomLeftRadius: "20px", borderBottomRightRadius: "20px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" },
  logoContainer: { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "5px" },
  headerIcon: { fontSize: "28px" },
  headerTitle: { fontSize: "24px", fontWeight: "bold", margin: 0 },
  headerSubtitle: { fontSize: "14px", opacity: 0.9, margin: 0 },
  mainContent: { padding: "20px 15px", maxWidth: "650px", margin: "0 auto" },
  card: { background: "#ffffff", padding: "20px", borderRadius: "14px", marginBottom: "15px", boxShadow: "0 3px 10px rgba(0,0,0,0.06)", border: "1px solid #eee" },
  cardHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", borderBottom: "1px solid #f0f0f0", paddingBottom: "8px" },
  cardIcon: { fontSize: "18px" },
  cardTitle: { fontSize: "16px", fontWeight: "bold", margin: 0, color: "#222" },
  cardDescription: { fontSize: "12px", color: "#666", marginTop: "-6px", marginBottom: "12px" },
  uploadBox: { border: "2px dashed #bbb", borderRadius: "10px", padding: "16px", textAlign: "center", background: "#fdfdfd" },
  uploadLabel: { display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", fontSize: "13px" },
  gridTwoColumns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  label: { fontSize: "13px", fontWeight: "bold", color: "#444" },
  select: { padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "13px", background: "#fff", color: "#333" },
  input: { padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "13px" },
  questionDistributionGrid: { display: "flex", flexDirection: "column", gap: "10px" },
  rowInput: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f9f9f9", borderRadius: "10px", border: "1px solid #eaeaea" },
  rowLabelIcon: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "bold" },
  smallInput: { width: "60px", padding: "8px", textAlign: "center", borderRadius: "8px", border: "1px solid #ccc", fontSize: "13px", fontWeight: "bold" },
  submitBtn: { width: "100%", padding: "15px", background: "#0f9d58", color: "white", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 10px rgba(15,157,88,0.2)" },
  wordBtn: { width: "100%", padding: "12px", background: "#2563eb", color: "white", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "15px" },
  preFormat: { whiteSpace: "pre-wrap", fontFamily: "Arial, sans-serif", fontSize: "14px", background: "#f5f5f5", padding: "12px", borderRadius: "8px", lineHeight: "1.5" },
  footer: { background: "#1e293b", color: "#cbd5e1", textAlign: "center", padding: "15px", marginTop: "30px", borderRadius: "12px", fontSize: "12px" }
};

