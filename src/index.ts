import { PGlite } from '@electric-sql/pglite';
import { Elysia, t } from 'elysia';

const db = new PGlite('./pgdata');

await db.exec('DROP TABLE IF EXISTS todo');
await db.exec(`
  CREATE TABLE IF NOT EXISTS todo (
    id SERIAL PRIMARY KEY,
    task TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    priority INTEGER DEFAULT 1,
    done BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  -- Tareas completadas de ejemplo
  INSERT INTO todo (task, description, category, priority, done) VALUES
    ('Install PGlite from NPM', 'Instalar el paquete @electric-sql/pglite', 'setup', 3, true);
  INSERT INTO todo (task, description, category, priority, done) VALUES
    ('Load PGlite', 'Inicializar la base de datos PGlite en el proyecto', 'setup', 3, true);
  INSERT INTO todo (task, description, category, priority, done) VALUES
    ('Create a table', 'Crear la estructura de la tabla TODO con todos los campos necesarios', 'database', 2, true);
  INSERT INTO todo (task, description, category, priority, done) VALUES
    ('Insert some data', 'Agregar datos de ejemplo para probar la funcionalidad', 'database', 2, true);
  INSERT INTO todo (task, description, category, priority, done) VALUES
    ('Create REST API', 'Implementar endpoints REST con Elysia', 'backend', 3, true);

  -- Tareas pendientes de ejemplo
  INSERT INTO todo (task, description, category, priority) VALUES
    ('Add authentication', 'Implementar sistema de autenticación JWT', 'security', 3);
  INSERT INTO todo (task, description, category, priority) VALUES
    ('Add pagination', 'Implementar paginación en el endpoint GET', 'backend', 2);
  INSERT INTO todo (task, description, category, priority) VALUES
    ('Add filters', 'Agregar filtros por categoría y prioridad', 'backend', 2);
  INSERT INTO todo (task, description, category, priority) VALUES
    ('Write tests', 'Crear tests unitarios y de integración', 'testing', 1);
  INSERT INTO todo (task, description, category, priority) VALUES
    ('Deploy to production', 'Configurar y desplegar la aplicación', 'devops', 1);
`);

const app = new Elysia()
  // GET / - Obtener todas las tareas con estadísticas
  .get('/', async () => {
    const todos = await db.query('SELECT * FROM todo ORDER BY priority DESC, id ASC');
    const stats = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE done = true) as completed,
        COUNT(*) FILTER (WHERE done = false) as pending,
        COUNT(DISTINCT category) as categories
      FROM todo
    `);

    return {
      statistics: stats.rows[0],
      todos: todos.rows,
    };
  })

  // GET /:id - Obtener una tarea específica por ID
  .get(
    '/:id',
    async (c) => {
      const { id } = c.params;
      const result = await db.query('SELECT * FROM todo WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        c.set.status = 404;
        return { error: 'Task not found' };
      }

      return {
        task: result.rows[0],
      };
    },
    {
      params: t.Object({ id: t.Number() }),
    }
  )

  // POST / - Crear una nueva tarea
  .post(
    '/',
    async (c) => {
      const { task, description, category, priority } = c.body;
      const result = await db.query(
        'INSERT INTO todo (task, description, category, priority) VALUES ($1, $2, $3, $4) RETURNING *',
        [task, description || null, category || 'general', priority || 1]
      );

      return {
        message: 'Task created successfully',
        task: result.rows[0],
      };
    },
    {
      body: t.Object({
        task: t.String(),
        description: t.Optional(t.String()),
        category: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
      }),
    }
  )

  // PUT /:id - Actualizar una tarea
  .put(
    '/:id',
    async (c) => {
      const { id } = c.params;
      const { task, description, category, priority, done } = c.body;

      try {
        const result = await db.query(
          'UPDATE todo SET task = $1, description = $2, category = $3, priority = $4, done = $5 WHERE id = $6 RETURNING *',
          [
            task,
            description || null,
            category || 'general',
            priority || 1,
            done,
            id,
          ]
        );

        if (result.rows.length === 0) {
          c.set.status = 404;
          return { error: 'Task not found' };
        }

        return {
          message: 'Task updated successfully',
          task: result.rows[0],
        };
      } catch (error) {
        c.set.status = 500;
        return {
          error: 'Error updating task',
          details: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      params: t.Object({ id: t.Number() }),
      body: t.Object({
        task: t.String(),
        description: t.Optional(t.String()),
        category: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
        done: t.Boolean(),
      }),
    }
  )

  // DELETE /:id - Eliminar una tarea
  .delete(
    '/:id',
    async (c) => {
      const { id } = c.params;

      try {
        const result = await db.query('DELETE FROM todo WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
          c.set.status = 404;
          return { error: 'Task not found' };
        }

        return {
          message: 'Task deleted successfully',
          task: result.rows[0],
        };
      } catch (error) {
        c.set.status = 500;
        return {
          error: 'Error deleting task',
          details: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      params: t.Object({ id: t.Number() }),
    }
  )

  .listen(3000 || process.env.PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
