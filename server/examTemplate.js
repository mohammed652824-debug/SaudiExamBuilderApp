const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, VerticalAlign, ImageRun } = require("docx");
const fs = require("fs");
const path = require("path");

const borderStyle = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
const cellBorders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
const arabicFont = "Times New Roman";
const brandColor = "D2E2F7";

// دالة مخصصة لإصلاح اتجاه الأقواس في النصوص العربية داخل ملفات الوورد
function fixParentheses(text) {
    if (!text) return "";
    let str = text.toString();
    return str.replace(/\(/g, "TEMP_OPEN").replace(/\)/g, "(").replace(/TEMP_OPEN/g, ")");
}

// الدالة العامة لتنظيف النصوص والأسئلة والخيارات والترويسات لضبط الأقواس
function cleanGeneralText(text) {
    if (!text) return "";
    return fixParentheses(text.toString().replace(/\uFFFD/g, "").trim());
}

// دالة خاصة بتنظيف نصوص أسئلة التوصيل (صل) وقص الترقيم الزائد
function cleanMatchingText(text) {
    if (!text) return "";
    let cleaned = text.toString().replace(/\uFFFD/g, "").trim();
    if (/^\s*([0-9]+|[أ-ي]ـ?)\s*[\.\-\)\«\»\s:]+/.test(cleaned)) {
        cleaned = cleaned.replace(/^\s*([0-9]+|[أ-ي]ـ?)\s*[\.\-\)\«\»\s:]+\s*/, "");
    }
    return fixParentheses(cleaned.trim());
}

function fixArabicText(text) {
    if (!text) return "";
    return text.trim();
}

function shuffleArray(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

function createCell(text, widthPoints, alignment = AlignmentType.LEFT, bold = false, size = 24, vAlign = VerticalAlign.CENTER, bgColor = null) {
    const cellConfig = {
        borders: cellBorders,
        width: { size: widthPoints, type: WidthType.DXA },
        verticalAlign: vAlign,
        children: [
            new Paragraph({
                alignment,
                bidirectional: true,
                spacing: { before: 60, after: 60 },
                children: [
                    new TextRun({
                        text: fixArabicText(text),
                        bold,
                        size,
                        font: arabicFont,
                        bidi: true
                    })
                ]
            })
        ]
    };
    if (bgColor) {
        cellConfig.shading = { fill: bgColor };
    }
    return new TableCell(cellConfig);
}

// تعديل دالة createMergedCell لتدعم التفاف النص الطويل (الأسئلة الطويلة) بشكل سليم ومنظم
function createMergedCell(text, colSpan, rowSpan, widthPoints, alignment = AlignmentType.LEFT, bold = false, size = 24, bgColor = null) {
    const cellConfig = {
        borders: cellBorders,
        width: { size: widthPoints, type: WidthType.DXA },
        columnSpan: colSpan,
        rowSpan: rowSpan,
        verticalAlign: VerticalAlign.CENTER,
        children: [
            new Paragraph({
                alignment,
                bidirectional: true,
                spacing: { before: 100, after: 100 },
                children: [
                    new TextRun({
                        text: fixArabicText(text),
                        bold,
                        size,
                        font: arabicFont,
                        bidi: true
                    })
                ]
            })
        ]
    };
    if (bgColor) {
        cellConfig.shading = { fill: bgColor };
    }
    return new TableCell(cellConfig);
}

function createHeading(text, size = 26) {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        bidirectional: true,
        spacing: { before: 300, after: 150 },
        children: [new TextRun({ text: fixArabicText(text), bold: true, size: size, font: arabicFont, bidi: true })]
    });
}

function createExamDoc(data) {
    let result;
    try {
        if (typeof data === "string") {
            let cleanData = data.replace(/```json/g, "").replace(/```/g, "").trim();
            result = JSON.parse(cleanData);
        } else {
            result = data;
        }
    } catch (e) {
        return new Document({
            sections: [{
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: "⚠️ تعذر تحليل النتيجة. يرجى المحاولة مرة أخرى.", bold: true, size: 24, color: "FF0000" })]
                })]
            }]
        });
    }

    if (result && !result.title) {
        result.title = result.subject ? `اختبار ${result.subject}` : (result.grade ? `اختبار الصف ${result.grade}` : "اختبار");
    }

    if (!result || !result.title) {
        return new Document({
            sections: [{
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: "⚠️ لم يتم توليد نتيجة صالحة.", bold: true, size: 24, color: "FF0000" })]
                })]
            }]
        });
    }

    const children = [];
    const totalTableWidth = 11200;

    // 🌟 [تطهير وفلترة اسم المادة]
    let cleanSubject = (result.subject || result.title || "الرياضيات")
        .replace(/^لمادة\s+/, "")
        .replace(/للصف.*$/, "")
        .replace(/الفصل.*$/, "")
        .replace(/اختبار|نهائي/g, "")
        .trim();

    // 🌟 [تحديد الصف تلقائياً]
    let cleanGrade = result.grade || "___________";

    // 🌟 [تحديد الفصل الدراسي تلقائياً - نظام فصلين فقط]
    let currentTerm = "___________";
    const termValue = result.semester || result.term || "";
    if (termValue) {
        if (termValue.includes("الأول") || termValue.includes("اول") || termValue == "1") {
            currentTerm = "الأول";
        } else if (termValue.includes("الثاني") || termValue.includes("ثاني") || termValue == "2") {
            currentTerm = "الثاني";
        } else {
            currentTerm = termValue; 
        }
    }

    // 🌟 [بناء نص الترويسة الموحد بدون تكرار في التعريف]
    const headerInfoText = `المادة: ${cleanSubject}\nالصف: ${cleanGrade}\nالفصل الدراسي: ${currentTerm}\nالتاريخ:      /    / 1447هـ\nالزمن: ساعتان ونصف`;

    const logoPath = path.join(__dirname, "logo.png");
    let logoChildren = [];

    if (fs.existsSync(logoPath)) {
        try {
            const imgData = fs.readFileSync(logoPath);
            logoChildren.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new ImageRun({
                        data: imgData,
                        transformation: { width: 110, height: 85 }
                    })
                ]
            }));
        } catch (err) {
            logoChildren.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                children: [new TextRun({ text: "وزارة التعليم\nMinistry of Education", bold: true, size: 16, font: arabicFont, bidi: true })]
            }));
        }
    } else {
        logoChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            children: [new TextRun({ text: "وزارة التعليم\nMinistry of Education", bold: true, size: 16, font: arabicFont, bidi: true })]
        }));
    }

    children.push(
        new Table({
            width: { size: totalTableWidth, type: WidthType.DXA },
            alignment: AlignmentType.CENTER,
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                            width: { size: 4000, type: WidthType.DXA },
                            verticalAlign: VerticalAlign.CENTER,
                            children: [new Paragraph({
                                alignment: AlignmentType.LEFT,
                                bidirectional: true,
                                children: [new TextRun({ text: cleanGeneralText(headerInfoText), bold: true, size: 22, font: arabicFont, bidi: true })]
                            })]
                        }),
                        new TableCell({
                            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                            width: { size: 3200, type: WidthType.DXA },
                            verticalAlign: VerticalAlign.CENTER,
                            children: logoChildren
                        }),
                        new TableCell({
                            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                            width: { size: 4000, type: WidthType.DXA },
                            verticalAlign: VerticalAlign.CENTER,
                            children: [new Paragraph({
                                alignment: AlignmentType.CENTER,
                                bidirectional: true,
                                children: [new TextRun({ text: "المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة: ....................\nمكتب التعليم بـ: ....................\nالمدرسة: ....................", bold: true, size: 18, font: arabicFont, bidi: true })]
                            })]
                        })
                    ]
                })
            ]
        }),

        new Paragraph({
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { before: 200, after: 200 },
            children: [new TextRun({ text: `اختبار نهاية الفصل الدراسي لعام 1447هـ`, bold: true, size: 26, font: arabicFont, bidi: true })]
        }),

        new Table({
            width: { size: totalTableWidth, type: WidthType.DXA },
            alignment: AlignmentType.CENTER,
            rows: [
                new TableRow({
                    children: [
                        createCell("رقم الجلوس: .......................................", 3800, AlignmentType.LEFT, true, 22),
                        createCell("اسم الطالب/ة: .............................................................................", 7400, AlignmentType.LEFT, true, 22)
                    ]
                })
            ]
        }),
        new Paragraph({ spacing: { after: 300 }, children: [] })
    );

    // [1] الاختيار من متعدد - الترقيم يبدأ من 1 دائماً وبشكل مستقل
    if (result.multiple_choice && result.multiple_choice.length > 0) {
        children.push(createHeading(cleanGeneralText("السؤال الأول: اختر الإجابة الصحيحة مما يلي بوضعها داخل الجدول:")));
        let qNum = 1;
        for (const q of result.multiple_choice) {
            const questionText = cleanGeneralText(q.question);
            const optA = q.options?.["أ"] ? cleanGeneralText(q.options["أ"]) : " ";
            const optB = q.options?.["ب"] ? cleanGeneralText(q.options["ب"]) : " ";
            const optC = q.options?.["ج"] ? cleanGeneralText(q.options["ج"]) : " ";
            const optD = q.options?.["د"] ? cleanGeneralText(q.options["د"]) : " ";
            
            const questionRow = new TableRow({
                children: [
                    createMergedCell(questionText, 8, 1, 10300, AlignmentType.LEFT, true, 24),
                    createMergedCell(String(qNum++), 1, 2, 900, AlignmentType.CENTER, true, 24, brandColor)
                ]
            });
            const optionsRow = new TableRow({
                children: [
                    createCell(optD, 2050, AlignmentType.CENTER, false, 22),
                    createCell("د", 500, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor),
                    createCell(optC, 2050, AlignmentType.CENTER, false, 22),
                    createCell("ج", 500, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor),
                    createCell(optB, 2050, AlignmentType.CENTER, false, 22),
                    createCell("ب", 500, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor),
                    createCell(optA, 2050, AlignmentType.CENTER, false, 22),
                    createCell("أ", 500, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor)
                ]
            });
            children.push(
                new Table({ width: { size: totalTableWidth, type: WidthType.DXA }, alignment: AlignmentType.CENTER, rows: [questionRow, optionsRow] }),
                new Paragraph({ spacing: { after: 150 }, children: [] })
            );
        }
    }

    // [2] صح وخطأ - الترقيم يبدأ من 1 دائماً وبشكل مستقل
    if (result.true_false && result.true_false.length > 0) {
        children.push(createHeading(cleanGeneralText("السؤال الثاني: ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخاطئة:")));
        const tfRows = [];
        tfRows.push(new TableRow({
            children: [
                createCell(cleanGeneralText("الإجابة (✓ / ✗)"), 2300, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor),
                createCell(cleanGeneralText("العبارة"), 7900, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor),
                createCell(cleanGeneralText("م"), 1000, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor)
            ]
        }));
        let qNum = 1;
        for (const q of result.true_false) {
            tfRows.push(new TableRow({
                children: [
                    createCell("", 2300, AlignmentType.CENTER, false, 22),
                    createCell(cleanGeneralText(q.question), 7900, AlignmentType.LEFT, false, 22),
                    createCell(String(qNum++), 1000, AlignmentType.CENTER, false, 22, VerticalAlign.CENTER, brandColor)
                ]
            }));
        }
        children.push(
            new Table({ width: { size: totalTableWidth, type: WidthType.DXA }, alignment: AlignmentType.CENTER, rows: tfRows }),
            new Paragraph({ spacing: { after: 200 }, children: [] })
        );
    }

    // [3] التوصيل - بعثرة كاملة لضمان عدم تطابق السطور تلقائياً
    if (result.matching && result.matching.length > 0) {
        children.push(createHeading(cleanGeneralText("السؤال الثالث: صل فقرات العمود (أ) بما يناسبها من العمود (ب) بوضع الرقم المناسب:")));
        for (const q of result.matching) {
            const matchRows = [];
            matchRows.push(new TableRow({
                children: [
                    createCell(cleanGeneralText("العمود (ب)"), 4200, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor),
                    createCell(cleanGeneralText("رقم الإجابة"), 1600, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor),
                    createCell(cleanGeneralText("العمود (أ)"), 4400, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor),
                    createCell(cleanGeneralText("م"), 1000, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor)
                ]
            }));
            const colA = q.column_a || [];
            const colB = shuffleArray(q.column_b || []);
            const maxLen = Math.max(colA.length, colB.length);
            for (let i = 0; i < maxLen; i++) {
                matchRows.push(new TableRow({
                    children: [
                        createCell(cleanMatchingText(colB[i] || ""), 4200, AlignmentType.LEFT, false, 22),
                        createCell("", 1600, AlignmentType.CENTER, false, 22),
                        createCell(cleanMatchingText(colA[i] || ""), 4400, AlignmentType.LEFT, false, 22),
                        createCell(String(i + 1), 1000, AlignmentType.CENTER, false, 22, VerticalAlign.CENTER, brandColor)
                    ]
                }));
            }
            children.push(
                new Table({ width: { size: totalTableWidth, type: WidthType.DXA }, alignment: AlignmentType.CENTER, rows: matchRows }),
                new Paragraph({ spacing: { after: 200 }, children: [] })
            );
        }
    }

    // [4] إكمال الفراغات - الترقيم يبدأ من 1 دائماً وبشكل مستقل
    if (result.fill_blank && result.fill_blank.length > 0) {
        children.push(createHeading(cleanGeneralText("السؤال الرابع: أكمل الفراغات في الجمل التالية بما يناسبها من كلمات صحيحة:")));
        const fillRows = [];
        fillRows.push(new TableRow({
            children: [
                createCell(cleanGeneralText("الفقرة"), 9700, AlignmentType.LEFT, true, 22, VerticalAlign.CENTER, brandColor),
                createCell(cleanGeneralText("المسلسل"), 1500, AlignmentType.CENTER, true, 22, VerticalAlign.CENTER, brandColor)
            ]
        }));
        let qNum = 1;
        for (const q of result.fill_blank) {
            fillRows.push(new TableRow({
                children: [
                    createCell(cleanGeneralText(q.question), 9700, AlignmentType.LEFT, false, 22),
                    createCell(String(qNum++), 1500, AlignmentType.CENTER, false, 22, VerticalAlign.CENTER, brandColor)
                ]
            }));
        }
        children.push(
            new Table({ width: { size: totalTableWidth, type: WidthType.DXA }, alignment: AlignmentType.CENTER, rows: fillRows }),
            new Paragraph({ spacing: { after: 200 }, children: [] })
        );
    }

    // [5] الأسئلة المقالية - الترقيم يبدأ من 1 دائماً وبشكل مستقل
    if (result.essay && result.essay.length > 0) {
        children.push(createHeading(cleanGeneralText("السؤال الخامس: أجب عن الأسئلة المقالية التالية بوضوح:")));
        let qNum = 1;
        for (const q of result.essay) {
            const essayRows = [
                new TableRow({ children: [createMergedCell(`س ${qNum++}:  ${cleanGeneralText(q.question)}`, 1, 1, totalTableWidth, AlignmentType.LEFT, true, 24)] }),
                new TableRow({ children: [createMergedCell("جـ: ...................................................................................................................................................................................", 1, 1, totalTableWidth, AlignmentType.LEFT, false, 22)] }),
                new TableRow({ children: [createMergedCell("................................................................................................................................_______________________________________", 1, 1, totalTableWidth, AlignmentType.LEFT, false, 22)] })
            ];
            children.push(
                new Table({ width: { size: totalTableWidth, type: WidthType.DXA }, alignment: AlignmentType.CENTER, rows: essayRows }),
                new Paragraph({ spacing: { after: 200 }, children: [] })
            );
        }
    }

    // تذييل الصفحة والخاتمة المنسقة
    children.push(
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300, after: 100 }, children: [new TextRun({ text: "_________________________________________________________________________________", bold: true, size: 20, font: arabicFont })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 150, after: 250 }, children: [new TextRun({ text: cleanGeneralText("انتهت الأسئلة مع تمنياتي لكم بالتوفيق والنجاح الدائم ،،،"), bold: true, size: 24, font: arabicFont, bidi: true })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true, spacing: { after: 80 }, children: [new TextRun({ text: "معلم /ة المادة : .............................................", bold: true, size: 22, font: arabicFont, bidi: true })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true, spacing: { after: 100 }, children: [new TextRun({ text: "التوقيع : .............................................", bold: true, size: 22, font: arabicFont, bidi: true })] })
    );

    return new Document({
        sections: [{
            properties: { page: { margin: { top: 567, bottom: 567, left: 567, right: 567 } } },
            children: children
        }]
    });
}

module.exports = { createExamDoc };
