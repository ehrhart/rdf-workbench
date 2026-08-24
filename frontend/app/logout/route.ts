import { redirect } from 'next/navigation'
import { getWorkbenchRuntime } from '@/lib/runtime'

export async function GET() {
  await (await getWorkbenchRuntime()).auth.logout()

  redirect('/')
}
