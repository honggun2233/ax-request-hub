import { prisma } from '@/lib/prisma'
import { ProjectForm } from '@/src/components/ProjectForm'
import { notFound, redirect } from 'next/navigation'

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const { projectId } = await searchParams
  if (!projectId) redirect('/projects/new')
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) notFound()
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto pt-8 pb-12 px-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">신청서 확인</h1>
        <p className="text-sm text-[var(--muted)] mb-6">AI가 정리한 내용을 확인하고 수정한 뒤 제출하세요.</p>
        <ProjectForm
          initialData={{
            id: project.id,
            title: project.title,
            department: project.department,
            requesterName: project.requesterName,
            requesterEmail: project.requesterEmail,
            description: project.description,
            asIs: project.asIs,
            expectedBenefit: project.expectedBenefit,
            confidentialityLevel: project.confidentialityLevel as 'G1' | 'G2' | 'G3',
            championName: project.championName ?? '',
            estimatedUsers: project.estimatedUsers,
          }}
        />
      </div>
    </main>
  )
}
