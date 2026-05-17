'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { PublicHoliday } from '@/lib/types/database'

const STATES = ['Selangor', 'KL', 'Johor', 'Penang', 'Perak', 'Sabah', 'Sarawak', 'Kedah', 'Kelantan', 'Terengganu', 'NS', 'Pahang', 'Perlis', 'Melaka']

interface Props {
  holidays: PublicHoliday[]
  year: number
}

export function HolidaysClient({ holidays: initialHolidays, year }: Props) {
  const [holidays, setHolidays] = useState(initialHolidays)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name_zh: '', name_en: '', date: '', state: '__nationwide__' })
  const [loading, setLoading] = useState(false)

  const national = holidays.filter(h => !h.state)
  const stateHolidays = holidays.filter(h => h.state)

  async function handleAdd() {
    if (!form.name_en || !form.date) { toast.error('请填写假期名称和日期'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const payload = {
        name_zh: form.name_zh || form.name_en,
        name_en: form.name_en,
        date: form.date,
        state: form.state === '__nationwide__' ? null : form.state,
        year,
        is_replacement: false,
      }
      const { data, error } = await supabase.from('public_holidays').insert(payload).select().single()
      if (error) { toast.error('添加失败：' + error.message); return }
      setHolidays(prev => [...prev, data as PublicHoliday].sort((a, b) => a.date.localeCompare(b.date)))
      setShowAdd(false)
      setForm({ name_zh: '', name_en: '', date: '', state: '__nationwide__' })
      toast.success('假期已添加')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除此假期？')) return
    const supabase = createClient()
    const { error } = await supabase.from('public_holidays').delete().eq('id', id)
    if (error) { toast.error('删除失败'); return }
    setHolidays(prev => prev.filter(h => h.id !== id))
    toast.success('已删除')
  }

  function renderHolidayList(list: PublicHoliday[], title: string) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}（{list.length} 天）</h3>
        <div className="space-y-2">
          {list.map(h => (
            <Card key={h.id} className="shadow-sm border-gray-100">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="text-center w-12 flex-shrink-0">
                  <p className="text-xs text-gray-400">{format(parseISO(h.date), 'MMM')}</p>
                  <p className="text-lg font-bold text-gray-900 leading-none">{format(parseISO(h.date), 'd')}</p>
                  <p className="text-xs text-gray-400">{format(parseISO(h.date), 'EEE')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{h.name_zh || h.name_en}</p>
                  <p className="text-xs text-gray-400">{h.name_en}</p>
                </div>
                {h.state && (
                  <Badge variant="outline" className="text-xs text-blue-500 border-blue-200 flex-shrink-0">{h.state}</Badge>
                )}
                {h.is_replacement && (
                  <Badge variant="outline" className="text-xs text-orange-500 border-orange-200 flex-shrink-0">代替假</Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-300 hover:text-red-500 flex-shrink-0"
                  onClick={() => handleDelete(h.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{year} 年公共假期</h2>
        <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" />添加假期
        </Button>
      </div>

      {renderHolidayList(national, '全国公共假期')}
      {stateHolidays.length > 0 && renderHolidayList(stateHolidays, '州属假期')}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加公共假期</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>假期名称（中文）</Label>
              <Input placeholder="如：大宝森节" value={form.name_zh} onChange={e => setForm(f => ({ ...f, name_zh: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>假期名称（英文）*</Label>
              <Input placeholder="如：Thaipusam" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>日期 *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>适用范围</Label>
              <Select value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v ?? '__nationwide__' }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nationwide__">全国</SelectItem>
                  {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>取消</Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleAdd} disabled={loading}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
