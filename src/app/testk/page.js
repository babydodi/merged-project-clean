'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BookOpen, 
  Brain, 
  Trophy, 
  Clock, 
  Target,
  TrendingUp,
  Play,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Calendar,
  Award,
  Activity,
  Home,
  Settings,
  LogOut,
  Menu,
  X,
  Star,
  Zap
} from 'lucide-react'

export default function Dashboard2() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Mock data
  const studentData = {
    name: 'Sarah Johnson',
    totalTests: 24,
    completedTests: 18,
    averageScore: 85,
    studyHours: 42,
    currentStreak: 7,
    recentTests: [
      { id: 1, name: 'Reading Comprehension Test 1', score: 88, date: '2025-01-15', status: 'completed' },
      { id: 2, name: 'Grammar Assessment', score: 79, date: '2025-01-14', status: 'completed' },
      { id: 3, name: 'Vocabulary Quiz', score: 95, date: '2025-01-13', status: 'completed' },
      { id: 4, name: 'Listening Practice', score: 82, date: '2025-01-12', status: 'completed' },
    ],
    upcomingTasks: [
      { id: 1, name: 'Essay Submission', date: '2025-01-20', type: 'Assignment' },
      { id: 2, name: 'Midterm Exam', date: '2025-01-25', type: 'Exam' },
    ],
    progress: {
      reading: 75,
      writing: 60,
      speaking: 45,
      listening: 90,
    }
  }

  const Sidebar = () => (
    <motion.div
      initial={{ x: -250 }}
      animate={{ x: sidebarOpen ? 0 : -250 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 h-full w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] z-50 p-4 flex flex-col"
    >
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-primary-gh">EduTrack</h1>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-white hover:bg-[#2a2a2a]">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="flex-grow space-y-2">
        <SidebarItem icon={Home} label="Dashboard" isActive={true} />
        <SidebarItem icon={BookOpen} label="Courses" />
        <SidebarItem icon={Target} label="Goals" />
        <SidebarItem icon={Activity} label="Activity" />
        <SidebarItem icon={Settings} label="Settings" />
      </nav>
      <div className="mt-auto border-t border-[#2a2a2a] pt-4">
        <SidebarItem icon={LogOut} label="Logout" />
      </div>
    </motion.div>
  )

  const SidebarItem = ({ icon: Icon, label, isActive }) => (
    <a 
      href="#" 
      className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
        isActive 
          ? 'bg-primary-gh text-white shadow-lg' 
          : 'text-gray-300 hover:bg-[#2a2a2a] hover:text-white'
      }`}
    >
      <Icon className="h-5 w-5 mr-3" />
      <span>{label}</span>
    </a>
  )

  const MainContent = () => (
    <div className={`flex-grow p-8 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">Welcome back, {studentData.name}</h2>
        <Button onClick={() => setSidebarOpen(true)} variant="ghost" size="icon" className="text-white hover:bg-[#2a2a2a] md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Trophy} title="Average Score" value={`${studentData.averageScore}%`} color="text-green-400" />
        <StatCard icon={Clock} title="Study Hours" value={`${studentData.studyHours}`} color="text-blue-400" />
        <StatCard icon={CheckCircle2} title="Tests Completed" value={`${studentData.completedTests}/${studentData.totalTests}`} color="text-yellow-400" />
        <StatCard icon={Zap} title="Current Streak" value={`${studentData.currentStreak} Days`} color="text-red-400" />
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-[#2a2a2a] text-white">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary-gh data-[state=active]:text-white">Overview</TabsTrigger>
          <TabsTrigger value="progress" className="data-[state=active]:bg-primary-gh data-[state=active]:text-white">Detailed Progress</TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-primary-gh data-[state=active]:text-white">Tasks & Exams</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-[#1a1a1a] border-[#2a2a2a] text-white">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription className="text-gray-400">Your last 4 completed tests.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {studentData.recentTests.map(test => (
                    <li key={test.id} className="flex justify-between items-center border-b border-[#2a2a2a] pb-2 last:border-b-0">
                      <div className="flex items-center">
                        <Play className="h-5 w-5 text-primary-gh mr-3" />
                        <div>
                          <p className="font-medium">{test.name}</p>
                          <p className="text-sm text-gray-400">{test.date}</p>
                        </div>
                      </div>
                      <span className={`font-bold ${test.score >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>{test.score}%</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
              <CardHeader>
                <CardTitle>Upcoming Tasks</CardTitle>
                <CardDescription className="text-gray-400">Assignments and exams due soon.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {studentData.upcomingTasks.map(task => (
                    <li key={task.id} className="flex justify-between items-center border-b border-[#2a2a2a] pb-2 last:border-b-0">
                      <div className="flex items-center">
                        <Calendar className="h-5 w-5 text-blue-400 mr-3" />
                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-sm text-gray-400">{task.date}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold bg-[#2a2a2a] px-2 py-1 rounded-full text-gray-300">{task.type}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProgressCard title="Reading Skills" progress={studentData.progress.reading} />
            <ProgressCard title="Writing Skills" progress={studentData.progress.writing} />
            <ProgressCard title="Speaking Skills" progress={studentData.progress.speaking} />
            <ProgressCard title="Listening Skills" progress={studentData.progress.listening} />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
            <CardHeader>
              <CardTitle>All Tasks and Exams</CardTitle>
              <CardDescription className="text-gray-400">A comprehensive list of all your academic commitments.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">
                (This section would typically contain a detailed table or list of all tasks, assignments, and exams with filters and sorting options.)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-gray-500 mt-1">Based on last 30 days</p>
      </CardContent>
    </Card>
  )

  const ProgressCard = ({ title, progress }) => (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <Progress value={progress} className="w-full h-3 bg-[#2a2a2a]" indicatorClassName="bg-primary-gh" />
          <span className="text-sm font-medium">{progress}%</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {progress < 50 ? 'Needs improvement' : progress < 80 ? 'Good progress' : 'Excellent!'}
        </p>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <Sidebar />
      <MainContent />
    </div>
  )
}
