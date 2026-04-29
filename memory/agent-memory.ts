import Redis from 'ioredis';
import { logger } from '../tools/logger';

function createRedisClient() {
  // REDIS_URL takes priority; fall back to host/port
  const url = process.env.REDIS_URL;
  if (url) return new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

const redis = createRedisClient();

export interface Memory {
  key: string;
  value: string;
  agentId: string;
  timestamp: number;
  ttlSeconds?: number;
}

export async function saveMemory(agentId: string, key: string, value: string, ttlSeconds?: number): Promise<void> {
  const redisKey = `memory:${agentId}:${key}`;
  if (ttlSeconds) {
    await redis.set(redisKey, value, 'EX', ttlSeconds);
  } else {
    await redis.set(redisKey, value);
  }
  // maintain a sorted set index for recency
  await redis.zadd(`memory:${agentId}:index`, Date.now(), key);
  logger.debug('Saved memory', { agentId, key });
}

export async function getMemory(agentId: string, key: string): Promise<string | null> {
  return redis.get(`memory:${agentId}:${key}`);
}

export async function getRecentMemories(agentId: string, limit = 20): Promise<Memory[]> {
  const keys = await redis.zrevrange(`memory:${agentId}:index`, 0, limit - 1, 'WITHSCORES');
  const memories: Memory[] = [];
  for (let i = 0; i < keys.length; i += 2) {
    const key = keys[i];
    const timestamp = Number(keys[i + 1]);
    const value = await redis.get(`memory:${agentId}:${key}`);
    if (value !== null) {
      memories.push({ agentId, key, value, timestamp });
    }
  }
  return memories;
}

export async function deleteMemory(agentId: string, key: string): Promise<void> {
  await redis.del(`memory:${agentId}:${key}`);
  await redis.zrem(`memory:${agentId}:index`, key);
}

export async function clearAgentMemory(agentId: string): Promise<void> {
  const keys = await redis.zrange(`memory:${agentId}:index`, 0, -1);
  const pipeline = redis.pipeline();
  for (const key of keys) pipeline.del(`memory:${agentId}:${key}`);
  pipeline.del(`memory:${agentId}:index`);
  await pipeline.exec();
  logger.info('Cleared all memory', { agentId });
}

export { redis };
