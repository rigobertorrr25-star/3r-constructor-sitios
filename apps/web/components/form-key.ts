/**
 * Clave para volver a montar un formulario después de cada envío. React 19 reinicia el formulario al terminar la
 * acción, y una lista desplegable vuelve a la opción con que se pintó la primera vez, no a la recién guardada.
 */
export const formKey = (updatedAt: string | null, state: unknown) => `${updatedAt ?? ''}|${state ? JSON.stringify(state) : ''}`;
