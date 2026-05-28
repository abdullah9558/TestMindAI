import dotenv from "dotenv";
const r = dotenv.config();
console.log(JSON.stringify(r, null, 2));
console.log('DB_NAME=' + process.env.DB_NAME);
console.log('DB_HOST=' + process.env.DB_HOST);
console.log('DB_USER=' + process.env.DB_USER);
console.log('DB_PASSWORD=' + process.env.DB_PASSWORD);
