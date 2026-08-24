using System.IO.Compression;
using System.Text;
using System.Xml.Linq;

var output = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../docs/SystemScope-Detailed-Technical-Design-Template.docx"));
Directory.CreateDirectory(Path.GetDirectoryName(output)!);
XNamespace w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
XNamespace r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
XElement P(string text, string? style = null) => new(w + "p", style is null ? null : new XElement(w + "pPr", new XElement(w + "pStyle", new XAttribute(w + "val", style))), new XElement(w + "r", new XElement(w + "t", new XAttribute(XNamespace.Xml + "space", "preserve"), text)));
XElement Table(params string[][] rows) => new(w + "tbl",
    new XElement(w + "tblPr", new XElement(w + "tblW", new XAttribute(w + "w", "0"), new XAttribute(w + "type", "auto")), new XElement(w + "tblBorders", new[] { "top", "left", "bottom", "right", "insideH", "insideV" }.Select(x => new XElement(w + x, new XAttribute(w + "val", "single"), new XAttribute(w + "sz", "4"), new XAttribute(w + "color", "B7C9C5"))))),
    rows.Select(row => new XElement(w + "tr", row.Select(cell => new XElement(w + "tc", new XElement(w + "tcPr", new XElement(w + "tcW", new XAttribute(w + "w", "2400"), new XAttribute(w + "type", "dxa"))), P(cell))))));

var body = new XElement(w + "body",
    P("SYSTEMSCOPE", "Title"), P("Detailed Technical Design", "Subtitle"), P("{{PROJECT_NAME}}"), P("{{DOCUMENT_VERSION}}  ·  {{DOCUMENT_DATE}}  ·  {{CLASSIFICATION}}"),
    P("Document control", "Heading1"), Table(["Document owner", "{{DOCUMENT_OWNER}}"], ["Technical owner", "{{TECHNICAL_OWNER}}"], ["Version", "{{DOCUMENT_VERSION}}"], ["Status", "Draft"], ["Classification", "{{CLASSIFICATION}}"]),
    P("Revision history", "Heading1"), Table(["Version", "Date", "Author", "Change"], ["0.1", "{{DOCUMENT_DATE}}", "{{AUTHOR}}", "Initial draft"]),
    P("Review and approval", "Heading1"), Table(["Role", "Name", "Decision", "Date"], ["Technical reviewer", "", "", ""], ["Business owner", "", "", ""], ["Approver", "", "", ""]),
    P("Contents", "Heading1"), P("Update the table of contents in Word after generation (References → Update Table)."),
    P("1. Executive summary", "Heading1"), P("{{EXECUTIVE_SUMMARY}}"),
    P("2. Objectives, scope and approach", "Heading1"), P("{{SCOPE_AND_APPROACH}}"), P("2.1 Assumptions and exclusions", "Heading2"), P("{{ASSUMPTIONS_AND_EXCLUSIONS}}"),
    P("3. Business context and requirements", "Heading1"), P("{{BUSINESS_CONTEXT}}"), P("3.1 Requirements", "Heading2"), P("{{REQUIREMENTS}}"),
    P("4. Technical landscape overview", "Heading1"), P("{{LANDSCAPE_OVERVIEW}}"), P("4.1 Application relationship diagram", "Heading2"), P("{{LANDSCAPE_DIAGRAM}}"),
    P("5. Application technical designs", "Heading1"), P("Repeat the following subsections for every application in assessment scope."),
    P("5.x {{APPLICATION_NAME}}", "Heading2"), P("{{APPLICATION_OVERVIEW}}"),
    P("Architecture and components", "Heading3"), P("{{ARCHITECTURE}}"), P("Frontend and backend technologies", "Heading3"), P("{{TECHNOLOGIES}}"),
    P("Database design", "Heading3"), P("{{DATABASE}}"), P("Infrastructure and environments", "Heading3"), P("{{INFRASTRUCTURE}}"),
    P("Interfaces and data flows", "Heading3"), P("{{INTEGRATIONS}}"), P("Security and access controls", "Heading3"), P("{{SECURITY}}"),
    P("Deployment, operations and monitoring", "Heading3"), P("{{OPERATIONS}}"), P("Constraints and technical debt", "Heading3"), P("{{LIMITATIONS}}"),
    P("6. Cross-application integration catalogue", "Heading1"), P("{{INTEGRATION_CATALOGUE}}"),
    P("7. Data architecture and information flows", "Heading1"), P("{{DATA_ARCHITECTURE}}"),
    P("8. Non-functional requirements", "Heading1"), P("{{NON_FUNCTIONAL_REQUIREMENTS}}"),
    P("9. Findings, risks and information gaps", "Heading1"), P("{{FINDINGS_AND_GAPS}}"),
    P("10. Recommended actions and roadmap", "Heading1"), P("{{ACTIONS_AND_ROADMAP}}"),
    P("11. Evidence and source register", "Heading1"), P("{{EVIDENCE_REGISTER}}"),
    P("12. Appendices", "Heading1"), P("{{APPENDICES}}"),
    new XElement(w + "sectPr", new XElement(w + "headerReference", new XAttribute(w + "type", "default"), new XAttribute(r + "id", "rId2")), new XElement(w + "footerReference", new XAttribute(w + "type", "default"), new XAttribute(r + "id", "rId3")), new XElement(w + "pgSz", new XAttribute(w + "w", "11906"), new XAttribute(w + "h", "16838")), new XElement(w + "pgMar", new XAttribute(w + "top", "1134"), new XAttribute(w + "right", "1134"), new XAttribute(w + "bottom", "1134"), new XAttribute(w + "left", "1134"), new XAttribute(w + "header", "567"), new XAttribute(w + "footer", "567"))));
var document = new XDocument(new XDeclaration("1.0", "UTF-8", "yes"), new XElement(w + "document", new XAttribute(XNamespace.Xmlns + "w", w.NamespaceName), new XAttribute(XNamespace.Xmlns + "r", r.NamespaceName), body));

using var file = File.Create(output); using var zip = new ZipArchive(file, ZipArchiveMode.Create);
void Write(string path, string value) { var entry = zip.CreateEntry(path); using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false)); writer.Write(value); }
Write("[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>""");
Write("_rels/.rels", """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>""");
Write("word/document.xml", document.ToString(SaveOptions.DisableFormatting));
Write("word/_rels/document.xml.rels", """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>""");
Write("word/styles.xml", """<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:color w:val="243438"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:color w:val="087F72"/><w:sz w:val="44"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:color w:val="526C70"/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:color w:val="0B3A3B"/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:color w:val="087F72"/><w:sz w:val="27"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:color w:val="385D5C"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>""");
Write("word/header1.xml", """<?xml version="1.0" encoding="UTF-8"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:rPr><w:b/><w:color w:val="087F72"/></w:rPr><w:t>SystemScope · Detailed Technical Design</w:t></w:r></w:p></w:hdr>""");
Write("word/footer1.xml", """<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="657D7B"/><w:sz w:val="18"/></w:rPr><w:t>{{CLASSIFICATION}} · Generated from validated SystemScope records</w:t></w:r></w:p></w:ftr>""");
Console.WriteLine(output);
