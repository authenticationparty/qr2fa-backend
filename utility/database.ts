const cdata = {
    username: `qr2fa`,
    password: `PleaseUseAuthy`,
    address: `localhost`,
    database: `qr2fa`,
};

import monk from 'monk';
const db = monk(
    `mongodb+srv://${cdata.username}:${cdata.password}@${cdata.address}/${cdata.database}?retryWrites=true&w=majority`,
);

export default db;
