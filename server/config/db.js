const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const databasePath = path.join(__dirname, '..', 'database', 'orbit-coaching.db')
const db = new sqlite3.Database(databasePath)
db.configure('busyTimeout', 5000)

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(error) {
    if (error) return reject(error)
    resolve({ id: this.lastID, changes: this.changes })
  })
})

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)))
})

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)))
})

const exec = (sql) => new Promise((resolve, reject) => {
  db.exec(sql, (error) => (error ? reject(error) : resolve()))
})

module.exports = { db, run, get, all, exec, databasePath }
