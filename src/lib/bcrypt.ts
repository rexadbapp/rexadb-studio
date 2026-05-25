import { hash, compare } from 'bcryptjs';

export const bcrypt = {
  hash: (plain: string, saltRounds: number = 10): Promise<string> => hash(plain, saltRounds),
  compare: (plain: string, hash: string): Promise<boolean> => compare(plain, hash),
};
