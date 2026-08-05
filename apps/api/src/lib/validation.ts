import type { Context } from 'hono'
import type { ZodError } from 'zod'

// API-PATTERNS.md のエラー形式に合わせて zValidator のバリデーションエラーを整形するフック
export function formatValidationError(
  result: { success: true } | { success: false; error: ZodError },
  c: Context,
) {
  if (!result.success) {
    return c.json(
      {
        error: 'バリデーションエラー',
        code: 'VALIDATION_ERROR',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      400,
    )
  }
}
