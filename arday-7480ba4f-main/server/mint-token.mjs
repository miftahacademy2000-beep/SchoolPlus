import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const token = jwt.sign(
  { userId: 'e412a988-6f52-4451-b6a6-1ada98796cbc', email: 'miftahacademy2000@gmail.com' },
  process.env.JWT_SECRET,
  { expiresIn: '2h' },
);
console.log(token);