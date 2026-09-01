import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/Administrator/Desktop/badi-project/outputs/a-step-user-data";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const navy = "#111722";
const blue = "#2563EB";
const pale = "#F3F6FA";
const border = "#D9E1EA";

function styleDataSheet(sheet, headers, widths) {
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  const header = sheet.getRangeByIndexes(0, 0, 1, headers.length);
  header.format = {
    fill: navy,
    font: { bold: true, color: "#FFFFFF" },
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: border },
  };
  header.format.rowHeight = 34;
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 200, 1).format.columnWidth = width;
  });
  sheet.getRangeByIndexes(1, 0, 199, headers.length).format = {
    font: { color: "#1F2937" },
    verticalAlignment: "top",
    wrapText: true,
  };
  sheet.freezePanes.freezeRows(1);
}

const guide = workbook.worksheets.add("Archive Guide");
guide.showGridLines = false;
guide.getRange("A1:F1").merge();
guide.getRange("A1").values = [["A-Step user Data"]];
guide.getRange("A1:F1").format = {
  fill: navy,
  font: { bold: true, color: "#FFFFFF", size: 18 },
  verticalAlignment: "center",
};
guide.getRange("A1:F1").format.rowHeight = 42;
guide.getRange("A3:B8").values = [
  ["Purpose", "Private operational archive for website contacts, guide-download leads, and newsletter subscriptions."],
  ["Source of truth", "Encrypted Cloudflare D1 records remain authoritative. This Sheet is an organized operational copy."],
  ["Data flow", "Website → Cloudflare Worker validation → encrypted D1 → Queue → this Sheet. Contact messages also trigger a Cloudflare email notification."],
  ["Access", "Restrict this file to authorized A-Step operators and the dedicated Google service account used by the Worker."],
  ["Retention", "Keep active records for 24 months, then review or remove records that are no longer operationally required."],
  ["Handling", "Do not publish, share by public link, or place passwords, API keys, cookies, or raw IP addresses in this workbook."],
];
guide.getRange("A3:A8").format = { fill: pale, font: { bold: true, color: blue }, verticalAlignment: "top" };
guide.getRange("B3:B8").format = { font: { color: "#1F2937" }, wrapText: true, verticalAlignment: "top" };
guide.getRange("A3:B8").format.borders = { preset: "outside", style: "thin", color: border };
guide.getRange("A3:A8").format.columnWidth = 22;
guide.getRange("B3:B8").format.columnWidth = 92;
guide.getRange("A3:B8").format.rowHeight = 38;

const contacts = workbook.worksheets.add("Contacts");
styleDataSheet(contacts, [
  "Archive ID", "Received (UTC)", "Name", "Email", "Phone", "Service interest",
  "Message", "Locale", "Email delivery", "Submission ID",
], [20, 22, 24, 32, 20, 26, 64, 12, 18, 40]);

const guideLeads = workbook.worksheets.add("Guide Leads");
styleDataSheet(guideLeads, [
  "Archive ID", "Received (UTC)", "Name", "Email", "Guide", "Guide language",
  "Target country", "Locale", "Submission ID",
], [20, 22, 24, 32, 34, 18, 20, 12, 40]);

const newsletter = workbook.worksheets.add("Newsletter");
styleDataSheet(newsletter, [
  "Archive ID", "Received (UTC)", "Email", "Locale", "Consented at (UTC)",
  "Unsubscribed at (UTC)", "Submission ID",
], [20, 22, 34, 12, 24, 24, 40]);

for (const sheet of [contacts, guideLeads, newsletter]) {
  sheet.getRange("B2:B200").format.numberFormat = "yyyy-mm-dd hh:mm:ss";
}
newsletter.getRange("E2:F200").format.numberFormat = "yyyy-mm-dd hh:mm:ss";

const preview = await workbook.render({ sheetName: "Archive Guide", range: "A1:F8", scale: 1.5, format: "png" });
await fs.writeFile(`${outputDir}/archive-guide.png`, new Uint8Array(await preview.arrayBuffer()));

for (const sheetName of ["Contacts", "Guide Leads", "Newsletter"]) {
  const previewSheet = await workbook.render({ sheetName, range: sheetName === "Contacts" ? "A1:J8" : sheetName === "Guide Leads" ? "A1:I8" : "A1:G8", scale: 1.1, format: "png" });
  await fs.writeFile(`${outputDir}/${sheetName.toLowerCase().replaceAll(" ", "-")}.png`, new Uint8Array(await previewSheet.arrayBuffer()));
}

const check = await workbook.inspect({ kind: "sheet,table", maxChars: 5000, tableMaxRows: 10, tableMaxCols: 12 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "formula error scan" });
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = `${outputDir}/A-Step user Data.xlsx`;
await output.save(outputPath);
console.log(outputPath);
