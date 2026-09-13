import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import prisma from '../src/lib/prisma.js'
import { resetDb } from './helpers/db.js'
import { createUser, authHeader } from './helpers/factories.js'

describe('通知（GET /notifications, PATCH /:id/read）', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('已登入只會看到自己的通知＋公開通知，不會看到別人的私人通知', async () => {
    const user  = await createUser({ name: '自己' })
    const other = await createUser({ name: '別人' })
    await prisma.notification.create({ data: { userId: user.id, type: 'group_reviewed', title: '我的', message: 'm' } })
    await prisma.notification.create({ data: { userId: other.id, type: 'group_reviewed', title: '別人的', message: 'm' } })
    await prisma.notification.create({ data: { isPublic: true, type: 'group_reviewed', title: '公開', message: 'm' } })

    const res = await request(app).get('/api/notifications').set('Authorization', authHeader(user))
    expect(res.status).toBe(200)
    const titles = res.body.map(n => n.title).sort()
    expect(titles).toEqual(['公開', '我的'])
  })

  it('未登入只能看到公開通知', async () => {
    await prisma.notification.create({ data: { isPublic: true, type: 'group_reviewed', title: '公開', message: 'm' } })
    const user = await createUser()
    await prisma.notification.create({ data: { userId: user.id, type: 'group_reviewed', title: '私人', message: 'm' } })

    const res = await request(app).get('/api/notifications')
    expect(res.status).toBe(200)
    expect(res.body.map(n => n.title)).toEqual(['公開'])
  })

  it('PATCH /:id/read 標記自己的通知已讀', async () => {
    const user = await createUser()
    const notif = await prisma.notification.create({ data: { userId: user.id, type: 'group_reviewed', title: 't', message: 'm' } })

    const res = await request(app).patch(`/api/notifications/${notif.id}/read`).set('Authorization', authHeader(user))
    expect(res.status).toBe(200)
    expect((await prisma.notification.findUnique({ where: { id: notif.id } })).isRead).toBe(true)
  })

  it('PATCH /:id/read 不能標記別人的通知（403）', async () => {
    const user  = await createUser()
    const other = await createUser()
    const notif = await prisma.notification.create({ data: { userId: other.id, type: 'group_reviewed', title: 't', message: 'm' } })

    const res = await request(app).patch(`/api/notifications/${notif.id}/read`).set('Authorization', authHeader(user))
    expect(res.status).toBe(403)
    expect((await prisma.notification.findUnique({ where: { id: notif.id } })).isRead).toBe(false)
  })

  it('PATCH /:id/read 通知不存在回 404', async () => {
    const user = await createUser()
    const res = await request(app).patch('/api/notifications/does-not-exist/read').set('Authorization', authHeader(user))
    expect(res.status).toBe(404)
  })

  it('未登入呼叫 :id/read 回 401', async () => {
    expect((await request(app).patch('/api/notifications/anything/read')).status).toBe(401)
  })
})
