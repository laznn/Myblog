---
title: "Acquire and then Adapt：轻量的是适配器，不是 Flux"
date: 2026-07-30T02:30:00+08:00
lastmod: 2026-07-30T02:30:00+08:00
draft: false
description: "从 FluxGen 的纯合成数据和 FluxIR 的逐层 SE 调制，理解 0.4B 适配器如何控制冻结的 12B Flux，以及它真实需要的训练算力。"
summary: "FluxIR 并没有把 Flux 变成小模型：12B 主干仍参与每次前向计算，只是不更新权重。真正节省的是可训练参数、梯度与优化器状态。"
categories: ["Image Restoration"]
tags: ["Diffusion", "Flux", "Adapter", "论文阅读"]
keywords: ["Acquire and then Adapt", "FluxGen", "FluxIR", "Image Restoration", "SE Layer"]
paper_url: "https://arxiv.org/abs/2504.15159"
paper_authors: ["Junyuan Deng", "Xinyi Wu", "Yongxing Yang", "Congchao Zhu", "Song Wang", "Zhenyao Wu"]
venue: "CVPR 2025"
weight: 1
---

> **论文**：Deng et al. *Acquire and then Adapt: Squeezing out Text-to-Image Model for Image Restoration*, CVPR 2025。  
> **一句话概括**：先让 Flux 自己提供训练图，再用逐层 SE 适配器把它改造成真实图像修复模型。

这篇工作的方法并不复杂，重点是把数据和算力两笔账同时压了下来。FluxGen 从随机噪声和空提示词出发，用 Flux 生成 HQ 图像，再由 CLIP-IQA、MANIQA 和 MUSIQ 过滤失败样本，最后叠加模糊、下采样、噪声与 JPEG 压缩得到 LQ-HQ 对。最终训练集包含 35 万张纯合成图，不再额外收集真实原图。生成、筛选、模拟退化这条流水线并不新鲜，真正有价值的是它证明了 Flux 自生成数据可以独立支撑后续修复训练。

## 0.4B 为什么能控制 12B Flux

FluxIR 并不是重新学习生成能力，而是借用 Flux 已经学好的图像先验，只学习“应该怎样根据 LQ 图去调用这些先验”。它先用一个从 Flux 初始化的 MM-DiT 块提取 LQ 控制特征，再为 Flux 的 57 个 MM-DiT 块分别配置图像、文本两路 SE 层。每个 SE 都通过低秩瓶颈压缩特征，再把专属控制量送进对应层。这样既保留逐层调节能力，又不需要像 DreamClear 那样复制整套 DiT。

所以 0.4B 只是**可训练参数**。冻结的 12B Flux 仍要在每一步完整前向，反向传播也要穿过主干计算适配器梯度；节省的是主干权重梯度和 Adam 优化器状态，而不是把大模型从计算图里删掉。这就是它能接近大适配器效果的原因，也是“轻量”最容易被误解的地方。

## 实际上仍是大模型方案

论文使用 35 万张数据，在 4 张 NVIDIA H800 上训练 3.5 天，batch size 为 64，总计 14 GPU-days。这个配置比 SUPIR 和 DreamClear 便宜很多，但并不是消费级显卡实验。12B 参数仅以 BF16 保存权重就接近 24GB，再加适配器、激活值和反向传播缓存，单张 24GB 的 4090 或 32GB 的 5090 很难按论文分辨率直接复现；除非采用量化、CPU 卸载、梯度检查点和极小 batch，速度也会明显下降。

我对这篇论文的评价是：FluxGen 的思路比较常规，逐层双路 SE 控制更有意思。它在真实图的无参考指标和视觉纹理上表现突出，但 PSNR、SSIM 等保真指标并不占优，仍然存在生成式修复“看起来更真，却未必更接近原图”的老问题。它解决的是大模型修复训练太贵，而不是让大模型修复真正变成低算力方案。

原论文：[CVPR 2025](https://openaccess.thecvf.com/content/CVPR2025/html/Deng_Acquire_and_then_Adapt_Squeezing_out_Text-to-Image_Model_for_Image_CVPR_2025_paper.html)  
arXiv：[2504.15159](https://arxiv.org/abs/2504.15159)
