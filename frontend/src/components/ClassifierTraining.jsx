import React, { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  Database,
  Gauge,
  Play,
  RotateCcw,
  Settings2,
  Square,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const DEFAULT_CONFIG = {
  epochs: 20,
  learningRate: 0.001,
  batchSize: 32,
  datasetSplit: 80,
};

const CLASS_LABELS = [
  {
    name: "Elephant",
    description: "Large wildlife detection",
  },
  {
    name: "Tiger",
    description: "Tiger detection",
  },
  {
    name: "Leopard",
    description: "Leopard detection",
  },
  {
    name: "No Threat",
    description: "No wildlife threat detected",
  },
  {
    name: "Human intruder",
    description: "Unauthorized human movement",
  },
];

const initialHistory = [
  {
    epoch: 1,
    loss: 0.82,
    accuracy: 61.2,
    valLoss: 0.91,
    valAccuracy: 58.4,
  },
  {
    epoch: 2,
    loss: 0.71,
    accuracy: 67.8,
    valLoss: 0.79,
    valAccuracy: 64.1,
  },
  {
    epoch: 3,
    loss: 0.62,
    accuracy: 72.6,
    valLoss: 0.7,
    valAccuracy: 69.2,
  },
];

const ClassifierTraining = () => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [status, setStatus] = useState("idle");
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [history, setHistory] = useState(initialHistory);
  const [datasetSize] = useState(12480);
  const [modelVersion, setModelVersion] = useState("WG-Classifier-v1.4");

  const isTraining = status === "training";

  const latest = history.length
    ? history[history.length - 1]
    : {
        epoch: 0,
        loss: 0,
        accuracy: 0,
        valLoss: 0,
        valAccuracy: 0,
      };

  useEffect(() => {
    if (!isTraining) return;

    if (currentEpoch >= config.epochs) {
      setStatus("completed");
      return;
    }

    const timer = setTimeout(() => {
      const epoch = currentEpoch + 1;

      const progress = epoch / config.epochs;

      const loss = Math.max(
        0.08,
        0.9 - progress * 0.72 + (Math.random() * 0.04 - 0.02)
      );

      const accuracy = Math.min(
        98.5,
        55 + progress * 40 + (Math.random() * 2 - 1)
      );

      const valLoss = Math.max(
        0.1,
        loss + 0.08 + (Math.random() * 0.05 - 0.025)
      );

      const valAccuracy = Math.min(
        97.2,
        accuracy - 3 + (Math.random() * 2 - 1)
      );

      setHistory((previous) => [
        ...previous,
        {
          epoch,
          loss: Number(loss.toFixed(3)),
          accuracy: Number(accuracy.toFixed(2)),
          valLoss: Number(valLoss.toFixed(3)),
          valAccuracy: Number(valAccuracy.toFixed(2)),
        },
      ]);

      setCurrentEpoch(epoch);
    }, 800);

    return () => clearTimeout(timer);
  }, [isTraining, currentEpoch, config.epochs]);

  const progress = useMemo(() => {
    if (!config.epochs) return 0;
    return Math.min(100, (currentEpoch / config.epochs) * 100);
  }, [currentEpoch, config.epochs]);

  const updateConfig = (name, value) => {
    setConfig((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const startTraining = () => {
    setHistory([]);
    setCurrentEpoch(0);
    setStatus("training");
  };

  const stopTraining = () => {
    setStatus("idle");
  };

  const resetTraining = () => {
    setStatus("idle");
    setCurrentEpoch(0);
    setHistory(initialHistory);
    setConfig(DEFAULT_CONFIG);
  };

  const saveModel = () => {
    if (status !== "completed") return;

    const versionNumber =
      Number(modelVersion.split("v")[1]?.replace(".", "")) || 14;

    const nextVersion = ((versionNumber + 1) / 10).toFixed(1);

    setModelVersion(`WG-Classifier-v${nextVersion}`);
  };

  return (
    <div className="min-h-screen bg-[#071417] px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Page Header */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
                <BrainCircuit className="h-7 w-7" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                  AI Model Management
                </p>

                <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
                  Classifier Training
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Configure and train the WildGuard wildlife threat
                  classification model using the available detection dataset.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  isTraining
                    ? "animate-pulse bg-yellow-400"
                    : status === "completed"
                    ? "bg-emerald-400"
                    : "bg-slate-500"
                }`}
              />

              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Model Status
                </p>

                <p className="text-sm font-semibold capitalize text-slate-200">
                  {status}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <MetricCard
            icon={Database}
            label="Dataset Images"
            value={datasetSize.toLocaleString()}
            description="Available samples"
          />

          <MetricCard
            icon={Target}
            label="Validation Accuracy"
            value={`${latest.valAccuracy.toFixed(1)}%`}
            description="Latest validation"
          />

          <MetricCard
            icon={Gauge}
            label="Training Accuracy"
            value={`${latest.accuracy.toFixed(1)}%`}
            description="Latest training"
          />

          <MetricCard
            icon={TrendingDown}
            label="Current Loss"
            value={latest.loss.toFixed(3)}
            description="Training loss"
          />

        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">

          {/* Configuration */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70">

            <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
              <Settings2 className="h-5 w-5 text-emerald-400" />

              <div>
                <h2 className="font-bold text-white">
                  Training Configuration
                </h2>

                <p className="text-xs text-slate-500">
                  Configure model parameters
                </p>
              </div>
            </div>

            <div className="space-y-5 p-5">

              {/* Epochs */}
              <ConfigInput
                label="Epochs"
                description="Number of complete training passes"
                type="number"
                value={config.epochs}
                min={1}
                max={200}
                disabled={isTraining}
                onChange={(e) =>
                  updateConfig("epochs", Number(e.target.value))
                }
              />

              {/* Learning Rate */}
              <ConfigInput
                label="Learning Rate"
                description="Optimizer learning step"
                type="number"
                value={config.learningRate}
                min={0.00001}
                max={1}
                step={0.00001}
                disabled={isTraining}
                onChange={(e) =>
                  updateConfig("learningRate", Number(e.target.value))
                }
              />

              {/* Batch Size */}
              <ConfigInput
                label="Batch Size"
                description="Images processed per step"
                type="number"
                value={config.batchSize}
                min={1}
                max={512}
                disabled={isTraining}
                onChange={(e) =>
                  updateConfig("batchSize", Number(e.target.value))
                }
              />

              {/* Dataset Split */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-200">
                    Training Dataset Split
                  </label>

                  <span className="text-sm font-bold text-emerald-400">
                    {config.datasetSplit}%
                  </span>
                </div>

                <input
                  type="range"
                  min="50"
                  max="95"
                  value={config.datasetSplit}
                  disabled={isTraining}
                  onChange={(e) =>
                    updateConfig("datasetSplit", Number(e.target.value))
                  }
                  className="w-full accent-emerald-500"
                />

                <div className="mt-2 flex justify-between text-[10px] text-slate-600">
                  <span>Train</span>
                  <span>
                    Validation {100 - config.datasetSplit}%
                  </span>
                </div>
              </div>

              {/* Dataset Information */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />

                  <span className="text-xs font-bold text-slate-300">
                    Dataset Distribution
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <DistributionRow
                    label="Training"
                    value={`${config.datasetSplit}%`}
                  />

                  <DistributionRow
                    label="Validation"
                    value={`${100 - config.datasetSplit}%`}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">

                {!isTraining ? (
                  <button
                    type="button"
                    onClick={startTraining}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
                  >
                    <Play className="h-4 w-4" />
                    Start Training
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopTraining}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-400"
                  >
                    <Square className="h-4 w-4" />
                    Stop Training
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetTraining}
                  disabled={isTraining}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>

                <button
                  type="button"
                  onClick={saveModel}
                  disabled={status !== "completed"}
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Save Model
                </button>

              </div>
            </div>
          </section>

          {/* Training Monitor */}
          <div className="space-y-6">

            {/* Progress */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h2 className="font-bold text-white">
                    Training Progress
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    {isTraining
                      ? "Model is currently learning from the dataset."
                      : status === "completed"
                      ? "Training completed successfully."
                      : "Start training to begin model optimization."}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-2xl font-bold text-emerald-400">
                    {currentEpoch}
                    <span className="text-sm text-slate-500">
                      {" "}
                      / {config.epochs}
                    </span>
                  </p>

                  <p className="text-[10px] uppercase tracking-wider text-slate-600">
                    Epoch
                  </p>
                </div>

              </div>

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-[10px] text-slate-500">
                  <span>Training Progress</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

            </section>

            {/* Metrics */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              <MetricPanel
                title="Accuracy"
                icon={TrendingUp}
                training={latest.accuracy}
                validation={latest.valAccuracy}
                suffix="%"
              />

              <MetricPanel
                title="Loss"
                icon={TrendingDown}
                training={latest.loss}
                validation={latest.valLoss}
                suffix=""
              />

            </div>

            {/* History */}
            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">

              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="font-bold text-white">
                  Training History
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Performance recorded for each completed epoch
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-162.5 text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50 text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3">Epoch</th>
                      <th className="px-5 py-3">Loss</th>
                      <th className="px-5 py-3">Accuracy</th>
                      <th className="px-5 py-3">Val Loss</th>
                      <th className="px-5 py-3">Val Accuracy</th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-5 py-10 text-center text-sm text-slate-600"
                        >
                          Training data will appear here after the first epoch.
                        </td>
                      </tr>
                    ) : (
                      history
                        .slice()
                        .reverse()
                        .map((row) => (
                          <tr
                            key={row.epoch}
                            className="border-b border-slate-900 text-sm last:border-0 hover:bg-slate-900/30"
                          >
                            <td className="px-5 py-3 font-semibold text-slate-300">
                              {row.epoch}
                            </td>

                            <td className="px-5 py-3 text-slate-400">
                              {row.loss.toFixed(3)}
                            </td>

                            <td className="px-5 py-3 font-semibold text-emerald-400">
                              {row.accuracy.toFixed(2)}%
                            </td>

                            <td className="px-5 py-3 text-slate-400">
                              {row.valLoss.toFixed(3)}
                            </td>

                            <td className="px-5 py-3 font-semibold text-blue-400">
                              {row.valAccuracy.toFixed(2)}%
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>

            </section>

          </div>
        </div>

        {/* Classifier Classes */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">

          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-white">
                Classification Categories
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Wildlife and safety classes recognized by the classifier.
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
              Model:{" "}
              <span className="font-semibold text-emerald-400">
                {modelVersion}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {CLASS_LABELS.map((item) => (
              <div
                key={item.name}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-emerald-500/20 hover:bg-slate-900"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                  <Target className="h-4 w-4 text-emerald-400" />
                </div>

                <p className="text-sm font-bold text-slate-200">
                  {item.name}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

        </section>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-900 pt-4 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>WILDGUARD AI • Classifier Training Module</span>
          <span>Model: {modelVersion}</span>
        </div>

      </div>
    </div>
  );
};

/* ----------------------------- */
/* Reusable Components            */
/* ----------------------------- */

const MetricCard = ({ icon: Icon, label, value, description }) => {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex items-center justify-between">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
          <Icon className="h-5 w-5 text-emerald-400" />
        </div>
      </div>

      <p className="mt-4 text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-100">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-600">
        {description}
      </p>
    </div>
  );
};

const ConfigInput = ({
  label,
  description,
  type,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}) => {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-200">
        {label}
      </label>

      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
      />

      <p className="mt-1 text-[10px] text-slate-600">
        {description}
      </p>
    </div>
  );
};

const DistributionRow = ({ label, value }) => {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>

      <span className="font-semibold text-slate-300">{value}</span>
    </div>
  );
};

const MetricPanel = ({
  title,
  icon: Icon,
  training,
  validation,
  suffix,
}) => {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">

      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-emerald-400" />

        <h2 className="font-bold text-white">{title}</h2>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-600">
            Training
          </p>

          <p className="mt-1 text-xl font-bold text-emerald-400">
            {typeof training === "number"
              ? training.toFixed(title === "Loss" ? 3 : 1)
              : training}
            {suffix}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-600">
            Validation
          </p>

          <p className="mt-1 text-xl font-bold text-blue-400">
            {typeof validation === "number"
              ? validation.toFixed(title === "Loss" ? 3 : 1)
              : validation}
            {suffix}
          </p>
        </div>

      </div>
    </section>
  );
};

export default ClassifierTraining;