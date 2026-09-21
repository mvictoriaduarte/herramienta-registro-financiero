import * as XLSX from "xlsx";
import path from "path";

const workbookPath = path.join(process.cwd(), "Seguimiento ingresos.xlsx");
const wb = XLSX.readFile(workbookPath);

console.log("sheets", wb.SheetNames);

for (const name of ["Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre"]) {
  const sheet = wb.Sheets[name];
  if (!sheet) {
    console.log(name, "MISSING");
    continue;
  }
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });
  console.log("\n===", name, "rows", rows.length, "===");
  console.log(rows.slice(0, 20));
}
