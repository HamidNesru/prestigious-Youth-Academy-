// Usage: npm run create-school -- "School Name" "City" admin@school.et StrongPassword
import bcrypt from "bcryptjs";
import { db } from "../src/db.js";

const [name, city, email, password] = process.argv.slice(2);
if (!name || !email || !password || password.length < 8) {
  console.error('Usage: npm run create-school -- "School Name" "City" admin@email password(min 8 chars)');
  process.exit(1);
}
if (db.prepare("SELECT 1 FROM users WHERE lower(email)=lower(?)").get(email)) {
  console.error("That email is already used.");
  process.exit(1);
}
const tx = db.transaction(() => {
  const id = db.prepare("INSERT INTO schools(name,city,plan) VALUES (?,?, 'active')").run(name, city ?? "").lastInsertRowid as number;
  db.prepare("INSERT INTO users(school_id,name,email,password_hash,role) VALUES (?,?,?,?, 'admin')").run(id, "School Admin", email, bcrypt.hashSync(password, 10));
  const subj = db.prepare("INSERT INTO subjects(school_id,name,name_am) VALUES (?,?,?)");
  [["Mathematics", "ሒሳብ"], ["English", "እንግሊዝኛ"], ["Amharic", "አማርኛ"]].forEach(([n, a]) => subj.run(id, n, a));
  return id;
});
console.log(`Created school #${tx()} with admin ${email}`);
