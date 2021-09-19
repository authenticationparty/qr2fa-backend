// Connection data
const _ = {
    username: process.env.DB_USER || `your-username`,
    password: process.env.DB_PASS || `your-password`,
    address: process.env.DB_HOST || `your-address`,
    database: `qr2fa`,
};

import monk from 'monk';
const db = monk(
    `mongodb+srv://${_.username}:${_.password}@${_.address}/${_.database}?retryWrites=true&w=majority`,
);

export default db;
