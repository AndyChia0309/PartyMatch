import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { requireAdmin } from '../../middleware/auth.js'
import { getSignedDownloadUrl } from '../../lib/r2Storage.js'
import { adminAdjustBillingDate } from '../../services/groupLifecycle.service.js'
import { notify } from '../groups/shared.js'

const router = Router()

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { status = 'pending', skip = '0', take = '20' } = req.query
    const where = status === 'all' ? {} : { status }

    const reports = await prisma.platformReport.findMany({
      where,
      include: {
        reporter:        { select: { id: true, name: true, email: true } },
        group:           { select: { id: true, planName: true, service: { select: { name: true } }, host: { select: { id: true, name: true } } } },
        resolvedByAdmin: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:    parseInt(skip),
      take:    parseInt(take),
    })

    const payload = await Promise.all(reports.map(async r => ({
      id:                  r.id,
      groupId:             r.groupId,
      planName:            r.group.planName ?? r.group.service?.name ?? '',
      hostId:              r.group.host.id,
      hostName:            r.group.host.name,
      reporterId:          r.reporterId,
      reporterName:        r.reporter.name,
      reporterEmail:       r.reporter.email,
      description:         r.description,
      evidenceUrl:         r.evidenceUrl ? await getSignedDownloadUrl(r.evidenceUrl) : null,
      status:              r.status,
      resolutionNote:      r.resolutionNote,
      resolvedByAdminName: r.resolvedByAdmin?.name ?? null,
      createdAt:           r.createdAt,
      resolvedAt:          r.resolvedAt,
    })))

    res.json(payload)
  } catch (err) { next(err) }
});

router.post('/:id/resolve', requireAdmin, async (req, res, next) => {
  try {
    const report = await prisma.platformReport.findUnique({ where: { id: req.params.id } })
    if (!report) return res.status(404).json({ message: '找不到回報' })
    if (report.status === 'resolved') return res.status(400).json({ message: '這筆回報已經處理過' })

    const resolutionNote = req.body.resolutionNote?.trim() || null

    if (req.body.nextBillingDate) {
      await adminAdjustBillingDate({
        groupId:         report.groupId,
        nextBillingDate: req.body.nextBillingDate,
        note:            resolutionNote || '客服工單裁定調整',
      })
    }

    const updated = await prisma.platformReport.update({
      where: { id: report.id },
      data: {
        status:            'resolved',
        resolvedByAdminId: req.admin.id,
        resolutionNote,
        resolvedAt:        new Date(),
      },
    })

    notify({
      userId:  report.reporterId,
      type:    'platform_report_resolved',
      title:   '你的客服回報已處理',
      message: resolutionNote ? `平台已處理你的回報，備註：${resolutionNote}` : '平台已處理你的回報。',
      meta:    { groupId: report.groupId, reportId: report.id },
    })

    res.json(updated)
  } catch (err) { next(err) }
});

export default router
