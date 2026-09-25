require('./setup');
const request=require('supertest');
const app=require('../server');
const db=require('../config/database');
const {claimDuePosts}=require('../services/scheduler');
let token,user,other;
const auth=()=>({Authorization:`Bearer ${token}`});
beforeAll(async()=>{
 const a=await request(app).post('/api/auth/register').send({name:'Persistence Test',email:'persistence@example.com',password:'GoodPass123'});token=a.body.token;user=a.body.user.id;
 const b=await request(app).post('/api/auth/register').send({name:'Other User',email:'other-persistence@example.com',password:'GoodPass123'});other=b.body.token;
});
test('post update preserves identity, count and advanced settings through read',async()=>{
 const created=await request(app).post('/api/posts').set(auth()).send({content:'Original',platforms:['X'],advancedSettings:{followersOnlyReplies:true}});
 expect(created.status).toBe(201);const id=created.body.data.id;
 const edited=await request(app).put(`/api/posts/${id}`).set(auth()).send({content:'Edited',platforms:['YouTube'],advancedSettings:{madeForKids:true}});
 expect(edited.status).toBe(200);expect(edited.body.data.id).toBe(id);
 const read=await request(app).get(`/api/posts/${id}`).set(auth());expect(read.body.data.advancedSettings).toEqual({madeForKids:true});expect(read.body.data.text).toBe('Edited');
 expect(db.prepare('SELECT COUNT(*) n FROM posts WHERE user_id=?').get(user).n).toBe(1);
});
test('post undo restores same record and stays isolated from another user',async()=>{
 const created=await request(app).post('/api/posts').set(auth()).send({content:'Undo search needle',platforms:['X']});const id=created.body.data.id;
 expect((await request(app).delete(`/api/posts/${id}`).set(auth())).status).toBe(200);
 expect((await request(app).get(`/api/posts/${id}`).set(auth())).status).toBe(404);
 expect((await request(app).get('/api/search?q=Undo%20search%20needle').set(auth())).body.data.posts).toEqual([]);
 expect((await request(app).post(`/api/posts/${id}/restore`).set('Authorization',`Bearer ${other}`)).status).toBe(404);
 expect((await request(app).post(`/api/posts/${id}/restore`).set(auth())).body.data.id).toBe(id);
});
test('published posts cannot be updated and queued deleted posts are never claimed',async()=>{
 const c=await request(app).post('/api/posts').set(auth()).send({content:'Locked',platforms:['X']});const id=c.body.data.id;
 db.prepare("UPDATE posts SET status='published' WHERE id=?").run(id);
 expect((await request(app).put(`/api/posts/${id}`).set(auth()).send({content:'Changed'})).status).toBe(409);
 db.prepare("UPDATE posts SET status='scheduled',scheduled_at='2020-01-01T00:00:00Z',deleted_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
 expect(claimDuePosts()).not.toContain(id);
 expect((await request(app).post(`/api/posts/${id}/restore`).set(auth())).body.data.status).toBe('draft');
});
test('duplicate platforms are rejected instead of a database error',async()=>{
 expect((await request(app).post('/api/posts').set(auth()).send({content:'x',platforms:['X','X']})).status).toBe(400);
});
test('AI archive, restore, pin and duplicate persist messages; undo preserves ID',async()=>{
 const c=await request(app).post('/api/ai/chats').set(auth()).send({title:'Original chat'});const id=c.body.data.id;
 db.prepare("INSERT INTO ai_messages(chat_id,role,content) VALUES(?,'user','Persistent message')").run(id);
 expect((await request(app).patch(`/api/ai/chats/${id}/archive`).set(auth())).status).toBe(200);
 expect((await request(app).post(`/api/ai/chats/${id}/messages`).set(auth()).send({text:'no'})).status).toBe(409);
 await request(app).patch(`/api/ai/chats/${id}/unarchive`).set(auth());
 expect((await request(app).patch(`/api/ai/chats/${id}/pin`).set(auth())).body.pinned).toBe(true);
 const copied=await request(app).post(`/api/ai/chats/${id}/duplicate`).set(auth());expect(copied.status).toBe(201);
 expect((await request(app).get(`/api/ai/chats/${copied.body.data.id}/messages`).set(auth())).body.data[0].content).toBe('Persistent message');
 await request(app).delete(`/api/ai/chats/${id}`).set(auth());
 expect((await request(app).get(`/api/ai/chats/${id}/messages`).set(auth())).status).toBe(404);
 expect((await request(app).post(`/api/ai/chats/${id}/restore`).set('Authorization',`Bearer ${other}`)).status).toBe(404);
 expect((await request(app).post(`/api/ai/chats/${id}/restore`).set(auth())).status).toBe(200);
 expect((await request(app).get(`/api/ai/chats/${id}/messages`).set(auth())).body.data).toHaveLength(1);
});
test('selected account and custom titles persist; another user account cannot be selected',async()=>{
 const id=Number(db.prepare("INSERT INTO social_accounts(user_id,platform,account_name) VALUES(?,'x','Account')").run(user).lastInsertRowid);
 const values={selectedAccounts:{x:id},customTitles:{Editor:['Write','Review']},timezone:'UTC',language:'en'};
 expect((await request(app).put('/api/settings').set(auth()).send(values)).status).toBe(200);
 const read=await request(app).get('/api/settings').set(auth());expect(read.body.data).toMatchObject(values);
 expect((await request(app).put('/api/settings').set('Authorization',`Bearer ${other}`).send({selectedAccounts:{x:id}})).status).toBe(400);
});
test('invalid locale cannot poison render; missing provider reports configuration honestly',async()=>{
 expect((await request(app).put('/api/settings').set(auth()).send({timezone:'Mars/Unknown'})).status).toBe(400);
 const c=await request(app).get('/api/capabilities');expect(c.status).toBe(200);expect(c.body.data.news).toBe(false);expect(c.body.data.ai).toBe(false);
 expect((await request(app).get('/api/news').set(auth())).status).toBe(503);
});
