// server.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL 資料庫連線設定（修改為你實際帳密）
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// 測試用首頁
app.get('/', (req, res) => {
  res.send('WhispEats API 伺服器正常運行！');
});

// 新增使用者 API
app.post('/api/registerUser', (req, res) => {
  const { uid, name, email, phone, address, payment } = req.body;

  const sql = `
    INSERT INTO user (uid, name, email, phone, address, payment)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [uid, name, email, phone, address, payment], (err, result) => {
    if (err) {
      console.error('寫入失敗：', err);
      return res.status(500).send('儲存使用者失敗');
    }
    res.status(200).send('使用者資料成功儲存');
  });
});

// 根據 UID 抓取使用者資料
app.get('/api/getUser', (req, res) => {
  const uid = req.query.uid;

  const sql = "SELECT name, address, email, phone, payment FROM user WHERE uid = ?";
  db.query(sql, [uid], (err, results) => {
    if (err) {
      console.error("❌ 讀取失敗：", err);
      return res.status(500).send("無法取得使用者資料");
    }

    if (results.length === 0) {
      return res.status(404).send("找不到使用者");
    }

    res.json(results[0]); // ✅ 回傳使用者資料
  });
});

// 更新使用者資料 API
app.post('/api/updateUser', (req, res) => {
  const { uid, name, address, phone, payment } = req.body;

  const sql = `
    UPDATE user 
    SET name = ?, address = ?, phone = ?, payment = ?
    WHERE uid = ?
  `;

  db.query(sql, [name, address, phone, payment, uid], (err, result) => {
    if (err) {
      console.error("❌ 更新失敗：", err);
      return res.status(500).send("更新失敗");
    }

    res.status(200).send("✅ 更新成功");
  });
});

// 撈取使用者所有收藏的餐廳
app.get('/api/collects', (req, res) => {
  const { uid } = req.query;

  const findUserSql = 'SELECT user_id FROM user WHERE uid = ?';
  db.query(findUserSql, [uid], (err, userResults) => {
    if (err || userResults.length === 0) {
      return res.status(500).json({ error: '找不到使用者' });
    }

    const user_id = userResults[0].user_id;

    // 撈出這個使用者收藏的所有餐廳資訊
    const sql = `
      SELECT b.business_id, b.businessName, b.businessPhoto
      FROM collects c
      JOIN business b ON c.business_id = b.business_id
      WHERE c.user_id = ?
    `;

    db.query(sql, [user_id], (err, results) => {
      if (err) return res.status(500).json({error: '伺服器錯誤'});
      res.json(results);
    });
  });
});

app.get('/api/checkFavorite', (req, res) => {
  const { uid, business_id } = req.query;

  console.log('收到 API 請求 /api/checkFavorite');
  console.log('uid:', uid);
  console.log('business_id:', business_id);

  const findUserSql = 'SELECT user_id FROM user WHERE uid = ?';
  db.query(findUserSql, [uid], (err, userResults) => {
    if (err) {
      console.error('找 user_id 時出錯:', err);
      return res.status(500).json({ error: '查詢 user 失敗' });
    }

    if (userResults.length === 0) {
      console.warn('找不到對應的 uid');
      return res.status(404).json({ error: '找不到使用者' });
    }

    const user_id = userResults[0].user_id;

    const sql = 'SELECT * FROM collects WHERE user_id = ? AND business_id = ?';
    db.query(sql, [user_id, business_id], (err, results) => {
      if (err) {
        console.error('查 collect 錯誤:', err);
        return res.status(500).json({ error: '伺服器錯誤' });
      }

      res.json({ isFavorite: results.length > 0 });
    });
  });
});

// 點愛心 ➜ 若原本沒收藏就插入，有收藏就刪除
app.post('/api/toggleFavorite', (req, res) => {
  const { uid, business_id } = req.body;

  const findUserSql = 'SELECT user_id FROM user WHERE uid = ?';
  db.query(findUserSql, [uid], (err, userResults) => {
    if (err || userResults.length === 0) {
      console.log('找不到 user_id，查詢結果:', userResults);
      return res.status(500).json({error: '找不到使用者' });
    }

    const user_id = userResults[0].user_id;

    const checkSql = 'SELECT * FROM collects WHERE user_id = ? AND business_id = ?';
    db.query(checkSql, [user_id, business_id], (err, results) => {
      if (err) return res.status(500).json({ error: '伺服器錯誤' });

      if (results.length > 0) {
        // 已收藏 ➜ 移除
        const deleteSql = 'DELETE FROM collects WHERE user_id = ? AND business_id = ?';
        db.query(deleteSql, [user_id, business_id], (err) => {
          if (err) return res.status(500).json({error: '無法取消收藏' });
          res.json({ status: 'removed' });
        });
      } else {
        // 未收藏 ➜ 新增
        const insertSql = 'INSERT INTO collects (user_id, business_id) VALUES (?, ?)';
        db.query(insertSql, [user_id, business_id], (err) => {
          if (err) return res.status(500).json({error: '無法新增收藏' });
          res.json({ status: 'added' });
        });
      }
    });
  });
});

//用uId抓取使用者的user_id
app.get('/api/getUserId', async (req, res) => {
  const uid = req.query.uid;
  const sql = 'SELECT user_id FROM user WHERE uid = ?';
  db.query(sql, [uid], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ error: '找不到 user_id' });
    }
    res.json({ user_id: results[0].user_id });
  });
});

const multer = require('multer');

// 初始化 multer
const upload = multer({ dest: 'uploads/' });

app.post('/api/registerRider', upload.fields([
  { name: 'headshot' }, { name: 'license' }
]), async (req, res) => {
  const { user_id, id_number, transportation } = req.body;
  const headshotPath = req.files['headshot'][0].path;
  const licensePath = req.files['license'][0].path;

  const sql = 'INSERT INTO rider SET ?';
  const riderData = {
    user_id,
    id_number,
    transportation,
    headshot: headshotPath,
    license: licensePath
  };

  db.query('INSERT INTO rider SET ?', riderData, (err, result) => {
    if (err) {
      console.error('資料庫錯誤：', err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    console.log('成功寫入資料：', result);
    res.json({ message: 'OK' });
  });
});

// 依據「顧客 user_id」查詢目前配送中訂單對應的外送員 user_id
app.get('/api/getRiderIdByCustomer', (req, res) => {
  const customerId = req.query.user_id;

  console.log("查詢外送員資料，使用者 ID:", customerId);

  const sql = `
    SELECT rider_user_id
    FROM orderform
    WHERE user_id = ? AND orderStatus = '準備中'
    LIMIT 1
  `;

  db.query(sql, [customerId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ error: '找不到外送員資料' });
    }
    res.json({ rider_user_id: results[0].rider_user_id });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ WhispEats API 正在 port ${PORT} 運行中`);
});

