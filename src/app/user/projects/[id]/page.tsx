"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import * as Blockly from "blockly";
import "blockly/blocks";
import {
  injectIndonesianScratchBlockly,
  defineIndonesianScratchBlocks,
  INDONESIAN_SCRATCH_TOOLBOX_XML,
  workspaceToCode,
} from "@/lib/blocklyIndonesianScratch";
import { useAuth } from "@/hooks/useAuth";
import type { BlocklyProject } from "@/types";
import {
  Button,
  Group,
  Stack,
  Text,
  Loader,
  ActionIcon,
  Paper,
  Divider,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconTerminal2,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
} from "@tabler/icons-react";

const WORKSPACE_ID = "blocklyWorkspace";

export default function BlocklyProjectEditorPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const router = useRouter();

  const blocklyDivRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const actionClearTimerRef = useRef<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [showOutput, setShowOutput] = useState(true);
  const [workspaceHeight, setWorkspaceHeight] = useState(500);
  const [workspaceXml, setWorkspaceXml] = useState<string | null>(null);

  // Responsive height
  useEffect(() => {
    const calc = () => {
      const header = 120;
      const h = window.innerHeight - header;
      setWorkspaceHeight(Math.max(320, h - (showOutput ? 200 : 0)));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [showOutput]);

  const loadProject = useCallback(async () => {
    if (!user?.id || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/user/blockly-projects?userId=${user.id}&projectId=${projectId}`
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memuat proyek");
      const p: BlocklyProject | null = json.project;
      if (!p) {
        setError("Proyek tidak ditemukan");
        return;
      }
      setTitle(p.title);
      setDescription(p.description || "");
      setIsPublic(p.is_public);
      setWorkspaceXml(p.workspace_xml || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat proyek");
    } finally {
      setLoading(false);
    }
  }, [user?.id, projectId]);

  useEffect(() => {
    loadProject();
    return () => workspaceRef.current?.dispose();
  }, [loadProject]);

  // Cleanup any pending action-clear timer on unmount
  useEffect(() => {
    return () => {
      try {
        if (actionClearTimerRef.current) {
          clearTimeout(actionClearTimerRef.current);
          actionClearTimerRef.current = null;
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Inject Blockly AFTER the workspace div is rendered (i.e., loading false)
  useEffect(() => {
    if (loading) return; // wait for data load to finish so div is in DOM
    if (!blocklyDivRef.current) return; // div not yet mounted
    // (Re)initialize workspace
    defineIndonesianScratchBlocks();
    workspaceRef.current?.dispose();
    workspaceRef.current = injectIndonesianScratchBlockly(WORKSPACE_ID, {
      toolbox: INDONESIAN_SCRATCH_TOOLBOX_XML,
    });
    if (workspaceXml) {
      try {
        const XmlAny = Blockly.Xml as unknown as {
          textToDom: (t: string) => Element;
          domToWorkspace: (dom: Element, ws: Blockly.Workspace) => void;
        };
        const dom = XmlAny.textToDom(workspaceXml);
        XmlAny.domToWorkspace(dom, workspaceRef.current);
      } catch (err) {
        // ignore malformed xml
        console.warn("Gagal memuat XML workspace:", err);
      }
    }
  }, [loading, workspaceXml]);

  // Global keyboard listener to forward keydown events to registered Scratch handlers.
  // We attach this once so key events reach handlers even if other elements stop propagation.
  useEffect(() => {
    const pressed = new Set<string>();
    const handler = (e: KeyboardEvent) => {
      const isSpace = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
      const key = isSpace ? 'spasi' : e.key;
      // ignore repeated keydown events while key is held
      if (pressed.has(key)) return;
      pressed.add(key);
      // @ts-ignore
      const handlers = window.__scratchEvents?.keys?.[key];
      if (handlers && handlers.length > 0) {
        try {
          // Try to describe the first handler so the Output shows what action is running
          try {
            const describeHandler = (fn: Function) => {
              try {
                const s = String(fn || '');
                const mPlay = s.match(/playSound\(\s*['"`]([^'"`]+)['"`]\s*\)/);
                if (mPlay) return `Mainkan suara: ${mPlay[1]}`;
                if (/stopAllSounds\s*\(/.test(s)) return 'Hentikan semua suara';
                const mLog = s.match(/console\.log\(\s*['"`]([^'"`]+)['"`]\s*\)/);
                if (mLog) return mLog[1];
                return 'Menjalankan aksi...';
              } catch {
                return 'Menjalankan aksi...';
              }
            };
            const desc = describeHandler(handlers[0]);
            // clear any previous auto-clear timer
            try {
              if (actionClearTimerRef.current) {
                clearTimeout(actionClearTimerRef.current);
                actionClearTimerRef.current = null;
              }
            } catch {/* ignore */}
            setOutput(desc);
            // schedule auto-clear to waiting message after 3 seconds
            try {
              actionClearTimerRef.current = window.setTimeout(() => {
                setOutput('menunggu aksi yang baru');
                actionClearTimerRef.current = null;
              }, 3000);
            } catch {
              /* ignore */
            }
          } catch (err) {
            // ignore errors while describing
          }

          handlers.forEach((h: Function) => {
            try {
              h();
            } catch (err) {
              console.error('Error in scratch handler', err);
            }
          });
        } finally {
          // Prevent default page behavior (e.g. scrolling) when a Scratch handler handled the key
          try { e.preventDefault(); } catch (ignored) {}
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      const isSpace = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
      const key = isSpace ? 'spasi' : e.key;
      pressed.delete(key);
    };
    document.addEventListener('keydown', handler, true);
    document.addEventListener('keyup', up, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
      document.removeEventListener('keyup', up, true);
    };
  }, []);

  const serialize = () => {
    if (!workspaceRef.current) return { xml: "", code: "" };
    const xmlDom = Blockly.Xml.workspaceToDom(workspaceRef.current);
    const xmlText = Blockly.Xml.domToText(xmlDom);
    const code = workspaceToCode(workspaceRef.current);
    return { xml: xmlText, code };
  };

  const saveAll = async () => {
    if (!user?.id || !projectId) return;
    setSaving(true);
    try {
      const { xml, code } = serialize();
      const res = await fetch("/api/user/blockly-projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          userId: user.id,
          title,
          description,
          isPublic,
          workspaceXml: xml,
          codeJs: code,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal simpan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  const runCode = () => {
    setRunning(true);
    setOutput("");
    try {
      const { code } = serialize();
      const logs: string[] = [];
      const originalLog = console.log;
      
      // Setup logging (capture all console.log output during the runtime session)
      console.log = (...args: unknown[]) => {
        const line = args
          .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
          .join(" ");
        logs.push(line);
        // only show the most recent lines (last 10) so Output stays focused on current events
        try {
          setOutput(logs.slice(-10).join("\n"));
        } catch (e) {
          /* ignore setState errors */
        }
        originalLog(...args); // Also log to browser console
      };
      
      // Initialize scratch events (runtime will also reinitialize inside the generated bootstrap)
      window.__scratchEvents = {
        flag: [],
        keys: {}
      };

      // Try to focus the Blockly container so keyboard events are delivered predictably.
      try {
        blocklyDivRef.current?.focus();
      } catch (e) {
        /* ignore */
      }
      
      const bootstrap = `
        // Initialize runtime environment
        window.__scratchEvents = { flag: [], keys: {} };
        
        // Define runtime helpers
        function sleep(ms) {
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        try {
          // Setup event handlers
          ${code}
          
          console.log('Program dimulai...');
          // Execute all flag click handlers
          if (window.__scratchEvents.flag && window.__scratchEvents.flag.length > 0) {
            for (const handler of window.__scratchEvents.flag) {
              if (typeof handler === 'function') {
                await handler();
              }
            }
          }
        } catch (err) {
          console.error("Runtime error:", err);
          throw err;
        }
      `;
      const full = `(async () => { ${bootstrap} })();`;
      // Install a minimal runtime sound API so generated code can call playSound / stopAllSounds
      // This will be available under window.__scratchRuntime inside generated code.
      try {
        if (typeof window !== 'undefined') {
          const w = window as any;
          w.__scratchRuntime = w.__scratchRuntime || {};
          if (!w.__scratchRuntime.playSound) {
            // simple beep using WebAudio
            w.__scratchRuntime.audioCtx = w.__scratchRuntime.audioCtx || new ((w.AudioContext) || (w as any).webkitAudioContext)();
            w.__scratchRuntime.playSound = (name: string) => {
              try {
                const ctx = w.__scratchRuntime.audioCtx;
                // resume context in case the browser suspended it due to autoplay policy
                if (typeof ctx.resume === 'function') ctx.resume().catch(()=>{});
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'sine';
                o.frequency.value = 600; // A simple tone
                o.connect(g);
                g.connect(ctx.destination);
                g.gain.value = 0.0001;
                // ramp to audible to avoid click
                g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
                o.start();
                // stop after 250ms
                setTimeout(() => {
                  try { g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.02); o.stop(); } catch(_){}}
                , 250);
              } catch (err) { console.error('playSound error', err); }
            };
            w.__scratchRuntime.stopAllSounds = () => { /* no-op for now */ };
          }
        }
      } catch (e) {
        /* ignore */
      }

      new Function(full)();

      // We intentionally do not add extra bootstrap logs here. The console.log override
      // will capture only event/runtime logs (and we display only the most recent ones).
    } catch (e) {
      setOutput(e instanceof Error ? e.message : "Error menjalankan kode");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Stack p="md" gap="sm" style={{ height: "100%", maxWidth: "100%" }}>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Kembali ke daftar">
            <ActionIcon
              variant="light"
              onClick={() => router.push("/user/projects")}
              aria-label="kembali"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Text fw={600} size="lg" style={{ lineHeight: 1.2 }}>
            {title || "Memuat..."}
          </Text>
        </Group>
        <Group gap="xs">
          <Tooltip
            label={showOutput ? "Sembunyikan Output" : "Tampilkan Output"}
          >
            <ActionIcon
              variant="light"
              aria-label="toggle-output"
              onClick={() => setShowOutput((s) => !s)}
            >
              {showOutput ? (
                <IconChevronDown size={18} />
              ) : (
                <IconChevronUp size={18} />
              )}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Jalankan kode (generate JS & eksekusi)">
            <Button
              leftSection={<IconPlayerPlay size={16} />}
              variant="light"
              onClick={runCode}
              loading={running}
            >
              Jalankan
            </Button>
          </Tooltip>
          <Tooltip label="Simpan proyek (XML + JS)">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={saveAll}
              loading={saving}
            >
              Simpan
            </Button>
          </Tooltip>
        </Group>
      </Group>
      <Divider my={0} />
      {loading ? (
        <Group justify="center" mt="xl">
          <Loader />
        </Group>
      ) : error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : (
        <Group align="stretch" gap="sm" style={{ flex: 1, minHeight: 0 }}>
          <Paper
            withBorder
            radius="md"
            p={0}
            style={{
              flex: 1,
              minHeight: 0,
              height: workspaceHeight,
              overflow: "hidden",
              position: "relative",
            }}
          >
                    <div
                      ref={blocklyDivRef}
                      id={WORKSPACE_ID}
                      tabIndex={0}
                      style={{ width: "100%", height: "100%" }}
                    />
          </Paper>
          {showOutput && (
            <Paper
              withBorder
              radius="md"
              p="xs"
              style={{
                width: 320,
                maxWidth: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <Group justify="space-between" mb={4} gap={4} wrap="nowrap">
                <Group gap={6}>
                  <IconTerminal2 size={16} />
                  <Text size="sm" fw={600}>
                    Output
                  </Text>
                </Group>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  aria-label="clear-output"
                  onClick={() => setOutput("")}
                >
                  <IconRefresh size={14} />
                </ActionIcon>
              </Group>
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  border: "1px solid var(--mantine-color-gray-3, #e1e3e8)",
                  borderRadius: 4,
                  padding: 6,
                  background: "#0e1116",
                  color: "#d1d5db",
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.4,
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                  }}
                >
                  {output || "(kosong)"}
                </pre>
              </div>
            </Paper>
          )}
        </Group>
      )}
    </Stack>
  );
}
