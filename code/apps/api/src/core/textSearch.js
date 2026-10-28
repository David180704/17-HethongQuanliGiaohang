// Tim kiem tieng Viet khong can go dau: "hoan kiem" tim ra "Hoàn Kiếm", "dong da" ra "Đống Đa".
// Nguoi dung dien thoai hay go khong dau; chu nao DA go co dau thi giu nguyen de tim chinh xac
// ("Hoàn" chi khop "Hoàn", khong khop "Hoan").
// Ham thuan: tra ve chuoi regex an toan (da escape ky tu dac biet) dung cho $regex cua MongoDB.

const VARIANTS = {
  a: "aàáạảãâầấậẩẫăằắặẳẵ",
  e: "eèéẹẻẽêềếệểễ",
  i: "iìíịỉĩ",
  o: "oòóọỏõôồốộổỗơờớợởỡ",
  u: "uùúụủũưừứựửữ",
  y: "yỳýỵỷỹ",
  d: "dđ",
};

const SPECIAL = /[.*+?^${}()|[\]\\]/;

function charClass(base) {
  const lower = VARIANTS[base];
  return `[${lower}${lower.toUpperCase()}]`;
}

/** "hoan kiem" -> "h[oòó...][aàá...]n k[iìí...][eèé...]m" */
export function toSearchRegex(text) {
  let pattern = "";
  for (const ch of String(text).normalize("NFC")) {
    const lower = ch.toLowerCase();
    if (VARIANTS[lower]) pattern += charClass(lower);
    else if (SPECIAL.test(ch)) pattern += `\\${ch}`;
    else pattern += ch;
  }
  return pattern;
}
