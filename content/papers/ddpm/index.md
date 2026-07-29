---
title: "读懂 DDPM：从加噪过程到噪声预测"
date: 2026-07-23
lastmod: 2026-07-23
draft: false
description: "梳理 Denoising Diffusion Probabilistic Models 的前向过程、反向过程与简化训练目标。"
summary: "DDPM 为什么可以从高斯噪声中生成图像？这篇笔记从前向加噪、反向去噪和噪声预测目标三个部分建立直觉。"
categories: ["Diffusion"]
tags: ["Diffusion", "DDPM", "论文阅读"]
keywords: ["DDPM", "diffusion model", "denoising"]
paper_url: "https://arxiv.org/abs/2006.11239"
authors: ["Jonathan Ho", "Ajay Jain", "Pieter Abbeel"]
weight: 1
---

{{< katex >}}

> **论文**：Ho, Jain, and Abbeel. *Denoising Diffusion Probabilistic Models*, 2020.  
> **一句话概括**：用固定的前向过程逐步破坏数据，再训练神经网络学习逆转这一过程。

## 这篇论文解决什么问题

DDPM 研究的是如何学习复杂的图像分布。它不直接让网络一次生成完整图像，而是把生成过程拆成许多简单的去噪步骤：从高斯噪声开始，每一步去掉少量噪声，最终得到符合数据分布的样本。

这种设计的关键价值在于，困难的“从无到有”被改写成了一系列更稳定的局部去噪问题。

## 前向过程：如何把图像变成噪声

给定干净图像 \(x_0\)，前向过程在每一步加入少量高斯噪声：

$$ q(x_t\mid x_{t-1}) = \mathcal{N}(x_t; \sqrt{1-\beta_t}x_{t-1}, \beta_t I). $$

记 \(\alpha_t=1-\beta_t\)，\(\bar\alpha_t=\prod_{s=1}^{t}\alpha_s\)，可以直接从 \(x_0\) 采样任意时刻的 \(x_t\)：

$$ x_t=\sqrt{\bar\alpha_t}x_0+\sqrt{1-\bar\alpha_t}\epsilon,\quad \epsilon\sim\mathcal N(0,I). $$

这条公式非常重要：训练时无需真的一步步加噪，只需随机采样时间步 \(t\) 和噪声 \(\epsilon\)，便能构造训练样本。

## 反向过程：网络究竟预测什么

真实的反向分布未知，因此使用参数化高斯分布 \(p_\theta(x_{t-1}\mid x_t)\) 逼近。论文采用 U-Net 预测加入到 \(x_t\) 中的噪声 \(\epsilon\)。常见的简化目标是：

$$ L_{simple}=\mathbb E_{t,x_0,\epsilon}\left[\lVert\epsilon-\epsilon_\theta(x_t,t)\rVert^2\right]. $$

直觉上，网络看到带噪图像和时间步，需要判断“其中哪一部分是噪声”。采样时反复调用这个网络，就能逐渐恢复图像结构。

## 阅读后的三个关键认识

1. **时间步是噪声强度的坐标。** 同一个去噪网络需要处理从轻微扰动到接近纯噪声的多种状态，因此时间嵌入不可缺少。
2. **训练与采样的代价不对称。** 训练可以一次构造任意 \(x_t\)，而原始采样仍需执行完整的马尔可夫链，这也是后续加速工作的主要切入点。
3. **扩散模型与图像复原天然相容。** 去噪、去模糊、超分辨率等任务都可被理解为在观测约束下恢复干净图像分布。

## 和图像复原的连接

无条件 DDPM 学习的是图像先验；图像复原则需要把退化观测 \(y\) 加入反向过程。后续方法通常通过条件网络、引导项或数据一致性约束，让每一步去噪既符合自然图像分布，也不偏离输入观测。

## 仍然值得追问

- 噪声预测、数据预测与 velocity prediction 在复原任务中有什么实际差异？
- 如何在减少采样步数的同时维持高频细节？
- 面对未知退化时，生成先验会带来恢复能力还是不可信的幻觉？

原论文：[Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)
