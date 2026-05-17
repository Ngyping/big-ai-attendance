import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

export default function SettingsPage() {
  return (
    <>
      <Header title="系统设置" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto w-full space-y-5">

        {/* Work Hours */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">工作时间设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>上班时间</Label>
                <Input type="time" defaultValue="09:00" />
              </div>
              <div className="space-y-1.5">
                <Label>下班时间</Label>
                <Input type="time" defaultValue="18:00" />
              </div>
              <div className="space-y-1.5">
                <Label>午休开始</Label>
                <Input type="time" defaultValue="13:00" />
              </div>
              <div className="space-y-1.5">
                <Label>午休结束</Label>
                <Input type="time" defaultValue="14:00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>迟到容忍分钟数（分钟）</Label>
              <Input type="number" defaultValue="15" className="w-32" />
            </div>
          </CardContent>
        </Card>

        {/* GPS Settings */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">GPS 打卡设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">启用 GPS 打卡验证</p>
                <p className="text-xs text-gray-500">员工须在办公室范围内才能打卡</p>
              </div>
              <Switch defaultChecked={false} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>办公室纬度</Label>
                <Input type="number" step="0.0001" defaultValue="3.1390" />
              </div>
              <div className="space-y-1.5">
                <Label>办公室经度</Label>
                <Input type="number" step="0.0001" defaultValue="101.6869" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>允许范围（米）</Label>
              <Input type="number" defaultValue="500" className="w-32" />
            </div>
          </CardContent>
        </Card>

        {/* Leave Carry Forward */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">年假结转政策</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">允许年假结转</p>
                <p className="text-xs text-gray-500">未用年假结转到下一年度</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="space-y-1.5">
              <Label>结转上限（天）</Label>
              <Input type="number" defaultValue="5" className="w-32" />
            </div>
            <div className="space-y-1.5">
              <Label>结转假期截止日期</Label>
              <Input type="text" defaultValue="3月31日" className="w-48" readOnly />
              <p className="text-xs text-gray-400">结转假期须在 Q1 结束前使用，否则作废</p>
            </div>
          </CardContent>
        </Card>

        {/* Overtime Rates */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">加班费率（Employment Act 1955）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: '工作日加班', value: '1.5x', note: '超过标准8小时' },
              { label: '休息日工作', value: '2.0x', note: '周六/周日' },
              { label: '公共假期工作', value: '3.0x', note: '法定公共假期' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.note}</p>
                </div>
                <span className="text-sm font-bold text-blue-600">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">保存设置</Button>
      </div>
    </>
  )
}
