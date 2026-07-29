---
title: "Restormer：高分辨率图像复原中的高效 Transformer"
date: 2026-07-20
lastmod: 2026-07-22
draft: false
description: "从 MDTA 与 GDFN 两个核心模块理解 Restormer 如何控制高分辨率自注意力的计算量。"
summary: "Restormer 不在空间位置之间构建平方复杂度的注意力，而是在通道维度建模全局关系，并用门控前馈网络保留局部结构。"
categories: ["Image Restoration"]
tags: ["Image Restoration", "Transformer", "去噪", "去模糊", "论文阅读"]
keywords: ["Restormer", "image restoration", "transformer"]
paper_url: "https://arxiv.org/abs/2111.09881"
authors: ["Syed Waqas Zamir", "Aditya Arora", "Salman Khan", "Munawar Hayat", "Fahad Shahbaz Khan", "Ming-Hsuan Yang"]
weight: 2
---

{{< katex >}}

> **论文**：Zamir et al. *Restormer: Efficient Transformer for High-Resolution Image Restoration*, CVPR 2022.  
> **一句话概括**：把注意力的主要计算从空间维度转移到通道维度，使 Transformer 能够处理高分辨率复原任务。

## 为什么普通自注意力不适合图像复原

图像复原通常保持输入分辨率，特征图中的 token 数量 \(HW\) 很大。标准自注意力需要构造 \(HW\times HW\) 的相关矩阵，复杂度随像素数量平方增长。对于高分辨率图像，这一成本很快变得不可接受。

另一方面，卷积虽然高效，却受限于固定的局部感受野。Restormer 的目标是在二者之间找到平衡：保留全局建模能力，同时让计算量随空间尺寸近似线性增长。

## 整体结构

Restormer 采用四层 U-Net 式编码器—解码器结构。编码阶段逐步降低空间分辨率、增加通道数；解码阶段恢复分辨率，并使用跳跃连接传递高分辨率细节。最高分辨率阶段末尾还有 refinement blocks，用于进一步修正输出。

真正决定模型特性的，是每个 Transformer block 中的两个模块：MDTA 和 GDFN。

## MDTA：在通道维度计算注意力

Multi-Dconv Head Transposed Attention 先用 \(1\times1\) 卷积聚合通道信息，再用 \(3\times3\) depth-wise 卷积引入局部上下文。与标准注意力不同，它计算的是通道之间的相关性，而不是所有空间位置之间的相关性。

这样得到的注意力矩阵规模与通道数有关，避开了 \((HW)^2\) 的空间复杂度。可以把它理解为：模型先在整幅图像上汇总每个通道的响应，再学习哪些特征通道应当相互增强或抑制。

## GDFN：带门控的前馈网络

Gated-Dconv Feed-Forward Network 将特征投影成两条分支，其中一条经过 GELU 激活，两条分支逐元素相乘：

$$ \hat X = W_p^0\,\mathrm{GELU}(W_d^1W_p^1X)\odot(W_d^2W_p^2X)+X. $$

门控机制让网络选择性地保留有用特征；depth-wise 卷积则补充了前馈网络原本缺少的局部空间建模。这对边缘、纹理和微小退化尤其重要。

## 为什么它对复原任务有效

- **全局关系**：MDTA 能利用远距离区域帮助判断局部退化。
- **局部归纳偏置**：两个核心模块都包含 depth-wise convolution，保留了卷积对局部结构的优势。
- **多尺度结构**：编码器—解码器同时处理语义上下文与高分辨率细节。
- **任务通用性**：论文在去雨、运动与散焦去模糊、合成及真实图像去噪等任务上进行验证。

## 阅读后的判断

Restormer 的贡献不只是“把 Transformer 用于复原”，而是重新选择了注意力发生的维度。它说明全局建模并不意味着必须显式比较每一对像素；通道统计同样可以传递全局信息。

它也给 Diffusion-based restoration 一个直接启发：如果去噪网络需要反复运行，高分辨率特征上的注意力成本会被采样步数放大，因此高效的全局模块尤其重要。

## 仍然值得追问

- 通道注意力在多大程度上能替代显式的空间长程关系？
- 同一套结构跨多种退化有效，但面对真实混合退化时是否仍需专门建模？
- 将 Restormer block 用作扩散模型去噪器时，质量与采样速度之间如何权衡？

原论文：[Restormer: Efficient Transformer for High-Resolution Image Restoration](https://arxiv.org/abs/2111.09881)
