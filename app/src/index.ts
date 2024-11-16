import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req: Request, res: Response) => {
    res.send('Hello, DevOps World with TypeScript!');
});

app.listen(PORT, () => {
    console.log(`App running on http://localhost:${PORT}`);
});
