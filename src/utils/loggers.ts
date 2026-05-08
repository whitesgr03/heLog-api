import debug from 'debug';

export const database = debug(`App: ${process.env.DB}`);
export const server = debug(`App: ${process.env.SERVER}`);
