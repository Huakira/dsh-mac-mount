'use strict';
/**
 * dsh-mac-mount — per-session mount of a local (Mac) folder, Cowork-style.
 *
 * Registers the `/macmount` command. Mount state is NOT stored anywhere:
 * it is derived from the session log itself (each invocation appends a
 * `command/run` event with the path as args), so forks/replays carry it.
 * Derived mounts are replayed into agents as a `mac-mount` sourced user
 * message at agent creation and on every mount/unmount.
 */

import { randomUUID } from 'node:crypto';

const CMD = 'macmount';
const SOURCE_KIND = 'mac-mount';

export const name = 'mac-mount';
export const inject = ['commands'];

function userMessage(text) {
	return {
		id: randomUUID(),
		role: 'user',
		content: [{ type: 'text', text }],
		source: { kind: SOURCE_KIND }
	};
}

/** Derive mounted folder paths from the session log (command/run history). */
function mountsOf(session) {
	const mounts = [];
	const push = (p) => {
		if (!mounts.includes(p)) mounts.push(p);
	};
	try {
		for (const ev of session.events) {
			if (ev?.type !== 'command/run' || ev?.data?.name !== CMD) continue;
			const raw = String(ev?.data?.args ?? '').trim();
			if (!raw || raw === 'list') continue;
			if (raw === 'clear') {
				mounts.length = 0;
				continue;
			}
			if (raw.startsWith('off ')) {
				const off = raw.slice(4).trim().replace(/^["']|["']$/g, '');
				const i = mounts.indexOf(off);
				if (i >= 0) mounts.splice(i, 1);
				continue;
			}
			push(raw.replace(/^["']|["']$/g, ''));
		}
	} catch {
		/* session log unavailable; treat as empty */
	}
	return mounts;
}

function injectMounts(agent, paths) {
	if (paths.length === 0) return;
	const list = paths.map((p) => `- ${p}`).join('\n');
	agent.inject(userMessage(
		'本会话已挂载用户的本地（macOS）工作文件夹。读写这些文件一律用 mcp__dshmac__* 工具（先调 mac_roots 确认可用范围，不要用本机路径工具）：\n' + list
	));
}

export function apply(ctx) {
	ctx.commands.register({
		name: CMD,
		description: '挂载本地（Mac）文件夹为本会话工作区',
		input: { hint: '<路径|list|off <路径>|clear>' },
		handler: (invocation) => {
			const { agent, rawInput } = invocation;
			const input = String(rawInput ?? '').trim();
			const current = mountsOf(agent.session);
			const done = (text) => Promise.resolve({ kind: 'success', text });

			if (!input || input === 'list') {
				const text = current.length === 0
					? '本会话尚未挂载本地文件夹。用 /macmount <路径> 挂载，或在输入框左侧「挂载文件夹」按钮选择。'
					: '本会话已挂载：\n' + current.map((p) => '- ' + p).join('\n');
				return done(text);
			}
			if (input === 'clear') {
				if (current.length > 0) {
					agent.inject(userMessage('本会话已卸载全部本地工作文件夹。在卸载确认前写入的文件不受影响。'));
				}
				return done(current.length === 0 ? '本会话本来就没有挂载本地文件夹。' : '已卸载全部本地文件夹（' + current.length + ' 个）。');
			}
			if (input.startsWith('off ')) {
				const off = input.slice(4).trim().replace(/^["']|["']$/g, '');
				if (!current.includes(off)) return Promise.resolve({ kind: 'error', text: '该路径不在本会话挂载列表里：' + off });
				const next = current.filter((p) => p !== off);
				if (next.length > 0) injectMounts(agent, next);
				else agent.inject(userMessage('本会话已卸载全部本地工作文件夹。'));
				return done('已卸载：' + off);
			}
			const p = input.replace(/^["']|["']$/g, '');
			const next = current.includes(p) ? current : [...current, p];
			injectMounts(agent, next);
			return done('已挂载：' + p + (current.includes(p) ? '（重复挂载，状态未变）' : ''));
		}
	});

	ctx.on('agent/created', (agent) => {
		try {
			injectMounts(agent, mountsOf(agent.session));
		} catch (error) {
			ctx.logger?.warn?.('mac-mount: replay mounts failed: %o', error);
		}
	});
}
