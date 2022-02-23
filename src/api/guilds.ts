import { Get, Router } from "@discordx/koa";
import type { Context } from "koa";
import { client } from "../main.js";
import { generateFlashsignerAddress } from '@nervina-labs/flashsigner'
import NodeRsa from 'node-rsa';
import { Buffer } from 'buffer';
import db from "../database";
import { User } from "../shared/firestoreTypes";

@Router()
export class API {
  @Get("/")
  index(context: Context) {
    context.body = `
      <div style="text-align: center">
        <h1>
          <a href="https://discord-ts.js.org">discord.ts</a> rest api server example
        </h1>
        <p>
          powered by <a href="https://koajs.com/">koa</a> and
          <a href="https://www.npmjs.com/package/@discordx/koa">@discordx/koa</a>
        </p>
      </div>
    `;
  }

  @Get()
  guilds(context: Context) {
    context.body = `${client.guilds.cache.map((g) => `${g.id}: ${g.name}\n`)}`;
  }

  @Get('/sign-success')
  async verifySig(context: Context) {

    const { flashsigner_data } = context.request.query;
    const data = JSON.parse(flashsigner_data as string);
    console.log(data)
    const { message, sig: signature } = data.result;
    const response = {
      message,
      "signature": signature.slice(520),
      "pubkey": signature.slice(0, 520)
    }
    const key = new NodeRsa()
    const buf = Buffer.from(response.pubkey, 'hex')
    const e = buf.slice(0, 4).reverse()
    const n = buf.slice(4).reverse()
    key.importKey({ e, n }, 'components-public')
    key.setOptions({ signingScheme: 'pkcs1-sha256' })
    const isSigValid = key.verify(
      Buffer.from(response.message),
      Buffer.from(response.signature, 'hex')
    )

    context.body = `Signature verified result: ${isSigValid}`;

    if (!isSigValid) return;

    const address = generateFlashsignerAddress(response.pubkey)
    console.log('address: ', address)


    const user: User = {
      wallet: address,
    };

    const userDoc = await db
      .collection("users")
      .doc(address)
      .get();

    console.log('userDoc: ', userDoc)
    if (userDoc.exists) return;
    await db
      .collection("users")
      .doc(address)
      .set(user);

  }
}
