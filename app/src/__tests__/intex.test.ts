import request from 'supertest';
import app from '../index'; 

describe('GET /example', () => {
  it('should return 200 and a welcome message', async () => {
    const response = await request(app).get('/example');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello, DevOps World with TypeScript!');
  });
});
