module.exports={up(db){
  db.prepare(`CREATE TABLE IF NOT EXISTS post_media (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(post_id,media_id)
  )`).run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_post_media_order ON post_media(post_id,sort_order)").run();
  db.prepare("INSERT OR IGNORE INTO post_media(post_id,media_id,sort_order) SELECT id,media_id,0 FROM posts WHERE media_id IS NOT NULL").run();
}};
