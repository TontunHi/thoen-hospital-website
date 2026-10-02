import { DocumentStorage } from '@/lib/storage/documentStorage'

export async function GET(
  request: Request,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await props.params
    const pathArray = resolvedParams.path

    if (!pathArray || pathArray.length === 0) {
      return new Response('Not Found', { status: 404 })
    }

    const relativePath = 'public/uploads/' + pathArray.join('/')
    return await DocumentStorage.serveFile(relativePath, request)
  } catch (error) {
    console.error('Dynamic file serving error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
