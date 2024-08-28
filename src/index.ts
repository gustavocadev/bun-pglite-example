import { PGlite } from '@electric-sql/pglite';
import { Elysia, t } from 'elysia';

const db = new PGlite('./pgdata');

await db.exec('DROP TABLE IF EXISTS todo');
await db.exec(`
  CREATE TABLE IF NOT EXISTS todo (
    id SERIAL PRIMARY KEY,
    task TEXT,
    done BOOLEAN DEFAULT false
  );
  INSERT INTO todo (task, done) VALUES ('Install PGlite from NPM', true);
  INSERT INTO todo (task, done) VALUES ('Load PGlite', true);
  INSERT INTO todo (task, done) VALUES ('Create a table', true);
  INSERT INTO todo (task, done) VALUES ('Insert some data', true);
  INSERT INTO todo (task) VALUES ('Update a task');
`);

const app = new Elysia()
  .get('/', async () => {
    const todos = await db.query('SELECT * FROM todo ORDER BY id');
    return todos.rows;
  })
  .post(
    '/',
    async (c) => {
      const { task } = c.body;
      await db.query('INSERT INTO todo (task) VALUES ($1)', [task]);
      return { message: 'Task added' };
    },
    { body: t.Object({ task: t.String() }) }
  )
  .put(
    '/:id',
    async (c) => {
      const { id } = c.params;
      const { task, done } = c.body;
      console.log({ id, task, done });

      try {
        await db.query('UPDATE todo SET task = $1, done = $2 WHERE id = $3', [
          task,
          Number(done) === 1 ? true : false,
          id,
        ]);

        return { message: 'Task updated' };
      } catch (error) {
        return {
          error: 'Error updating task',
        };
      }
    },
    {
      params: t.Object({ id: t.Number() }),
      body: t.Object({ task: t.String(), done: t.Boolean() }),
    }
  )
  .listen(3000 || process.env.PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
