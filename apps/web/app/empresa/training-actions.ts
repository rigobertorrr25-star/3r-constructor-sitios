'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import type { QuizResult } from '@/lib/training';
import { errorText, type ApiError } from '@/lib/types';

const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/training`;
const page = (companyId: string) => `/empresa/${companyId}/capacitaciones`;
export type CourseActionResult = { ok: false; error: string } | undefined;

export async function saveCourseAction(companyId: string, courseId: string | null, payload: Record<string, unknown>): Promise<CourseActionResult> {
  const res = await authedApi<{ id: string } & ApiError>(courseId ? `${path(companyId)}/${encodeURIComponent(courseId)}` : path(companyId), {
    method: courseId ? 'PUT' : 'POST',
    body: payload,
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo guardar el curso.') };
  revalidatePath(page(companyId), 'layout');
  redirect(`${page(companyId)}/${res.data.id}`);
}

/** Marca la lección como vista y sigue a la siguiente (o vuelve al curso). */
export async function lessonDoneAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  const courseId = String(formData.get('courseId') ?? '');
  const lessonId = String(formData.get('lessonId') ?? '');
  const next = String(formData.get('next') ?? '');
  await authedApi(`${path(companyId)}/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/done`, { method: 'POST' });
  revalidatePath(`/empresa/${companyId}`, 'layout');
  const base = `${page(companyId)}/${courseId}`;
  redirect(/^[0-9a-f-]{36}$/i.test(next) ? `${base}/leccion/${next}` : base);
}

export async function quizAction(
  companyId: string,
  courseId: string,
  answers: Record<string, number>,
): Promise<{ ok: false; error: string } | { ok: true; result: QuizResult }> {
  const res = await authedApi<QuizResult & ApiError>(`${path(companyId)}/${encodeURIComponent(courseId)}/quiz`, {
    method: 'POST',
    body: { answers },
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo calificar la evaluación.') };
  revalidatePath(`/empresa/${companyId}`, 'layout');
  return { ok: true, result: res.data };
}

async function act(formData: FormData, action: 'publish' | 'archive') {
  const companyId = String(formData.get('companyId') ?? '');
  const courseId = String(formData.get('courseId') ?? '');
  await authedApi(`${path(companyId)}/${encodeURIComponent(courseId)}/${action}`, { method: 'POST' });
  revalidatePath(page(companyId), 'layout');
}
export async function publishCourseAction(formData: FormData) {
  await act(formData, 'publish');
}
export async function archiveCourseAction(formData: FormData) {
  await act(formData, 'archive');
}

export async function deleteCourseAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/${encodeURIComponent(String(formData.get('courseId') ?? ''))}`, { method: 'DELETE' });
  redirect(page(companyId));
}
