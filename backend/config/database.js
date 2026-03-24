const mysql = require('mysql2/promise');
require('dotenv').config();

// DB 연결 풀 생성
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3300,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'groupware',
    waitForConnections: true,
    connectionLimit: 30,  // 동시접속 100명 기준 (평균 10~30명)
    queueLimit: 50,       // 초과 요청은 큐에서 대기 (0=무제한 → 메모리 위험)
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4'
});

// 연결 테스트
pool.getConnection()
    .then(connection => {
        console.log('✅ 데이터베이스 연결 성공');
        connection.release();
    })
    .catch(err => {
        console.error('❌ 데이터베이스 연결 실패:', err.message);
        process.exit(1);
    });

module.exports = pool;
