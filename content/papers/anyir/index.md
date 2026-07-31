---
title: "AnyIR：不靠 Diffusion 的轻量级 All-in-One 图像恢复"
date: 2026-07-31T00:00:00+08:00
lastmod: 2026-07-31T00:00:00+08:00
draft: false
description: "从 DAB、GatedDA 和空间频率融合理解 AnyIR：一个不使用扩散模型的轻量级统一图像恢复网络。"
summary: "AnyIR 的重点不是生成式扩散，而是用一次前向推理完成多退化恢复。它的创新更偏向轻量化结构组合，而不是新的理论体系。"
categories: ["Image Restoration"]
tags: ["All-in-One Restoration", "Transformer", "频域建模", "论文阅读"]
keywords: ["AnyIR", "DAB", "GatedDA", "Spatial-Frequency Fusion", "All-in-One Restoration"]
paper_url: "https://arxiv.org/abs/2504.14249"
venue: "TMLR 2026"
weight: 1
---

{{< katex >}}

> **论文**：*Any Image Restoration via Efficient Spatial-Frequency Degradation Adaptation*。  
> **一句话概括**：AnyIR 不使用 Diffusion、文本提示或大模型，而是通过轻量级 U 型网络和 DAB 模块，用一次前向推理处理去噪、去雨、去雾、去模糊和暗光增强。

## 它到底是不是 Diffusion

先把这一点说清楚：AnyIR 不是扩散模型。

它的基本映射是：

$$
\hat I_{HQ}=f_\theta(I_{LQ}).
$$

输入一张低质量图像，网络直接输出修复结果。网络中没有扩散时间步 (t)，没有逐步加噪和去噪，也没有从纯噪声反向采样的过程。

AnyIR 使用的是四层 U 型编码器—解码器结构。编码器逐步降低空间分辨率、增加通道数，解码器再恢复分辨率，同时通过跳跃连接保留浅层细节，最后使用全局残差把输入图像直接连接到输出端。

因此它属于轻量级前馈式图像恢复网络，而不是生成式 Diffusion Restoration。

## DAB 不是 Diffusion，而是退化自适应模块

DAB 的全称是 Degradation Adaptation Block。它处理的是特征，不是概率分布。

输入特征 (F_{in}) 首先进行 Skip-Split 交错通道拆分：

$$
F_{att}=\{F^{(1)},F^{(3)},F^{(5)},\ldots\},
$$

$$
F_{gate}=\{F^{(2)},F^{(4)},F^{(6)},\ldots\}.
$$

一半通道进入全局注意力分支，另一半进入 GatedDA 局部门控分支。随后，两路特征在空间域和频域进行融合，再经过前馈网络和残差连接得到输出。

这里的“自适应”是指网络根据输入特征动态调整通道和空间位置的权重，并不代表扩散模型中的随机时间演化。DAB 没有噪声变量，也没有 SDE、ODE 或多步采样过程。

## 为什么它可以做得比较轻

AnyIR 的效率来自多项设计共同作用，而不是某一个模块突然把计算量变没了。

首先，U 型结构让高分辨率特征尽量经过局部卷积，较重的全局建模更多放在低分辨率阶段。其次，Skip-Split 只让一半通道做全局注意力，另一半通道交给计算更便宜的门控卷积。

如果完整特征做全局注意力，空间复杂度近似为：

$$
O\left((HW)^2C\right).
$$

把通道分成两半后，注意力分支的通道规模减少，同时 GatedDA 分支主要使用局部操作，复杂度更接近：

$$
O(HWC).
$$

最后，AnyIR 只需要一次网络前向推理，而扩散修复通常需要：

$$
x_T\rightarrow x_{T-1}\rightarrow\cdots\rightarrow x_0
$$

多次调用去噪网络。即便扩散模型的单步网络很优秀，多轮采样累积起来仍然更慢、更占显存。这也是 AnyIR 更适合移动端和边缘设备的原因。

## GatedDA 具体做什么

GatedDA 主要针对局部、不均匀退化。它把特征拆成 (alpha,eta,gamma) 三部分：

- (alpha)：通过深度卷积提取空间细节；
- (eta)：保留输入中的原始信息；
- (gamma)：经过非线性激活后生成门控权重。

随后使用门控关系调制特征。直观地说，退化明显的位置被增强，干净区域则尽量保持稳定。作者还根据输入特征的均值和方差调节温度参数，使门控强度能够适应不同程度的噪声、雨丝或雾霾。

这与 RDBM 的残差噪声调制有一点相似：二者都不希望对整张图无差别处理。但它们所处的层次不同。RDBM 改变的是扩散过程中的噪声路径，AnyIR 只是改变网络内部的特征权重。

## 为什么还要做空间—频率融合

图像退化同时包含空间结构和频率结构。

- 雾霾、光照变化等大范围退化，需要全局空间上下文；
- 噪点、雨丝和局部模糊，更依赖局部空间特征；
- 文字、边缘和纹理主要体现在高频成分中。

因此，AnyIR 先进行空间域交叉增强，再将特征送到二维傅里叶域进行频率融合：

$$
F_{fuse}=\lambda F_s+(1-\lambda)F_f,
$$

其中 (F_s) 是空间域融合结果，(F_f) 是频域增强结果。

这套设计的直觉很合理：注意力负责理解“这片区域和远处有什么关系”，GatedDA 负责理解“这个局部退化应该怎么处理”，频域分支则帮助恢复边缘和纹理。

## 它和 Diffusion 方法有没有直接比较

AnyIR 的核心对比对象主要是 AirNet、IDR、PromptIR、MoCE-IR、OneRestore 和 TransWeather 等统一图像恢复方法。论文覆盖三类退化、五类退化、混合退化和未知去雪任务，并报告了较低的参数量、显存和 FLOPs。

但从主表来看，它并没有把 SUPIR、DiffBIR、DA-CLIP 这类大规模扩散修复方法作为主要同表对手。因此不能简单得出“AnyIR 全面击败 Diffusion”的结论。更准确的比较是：AnyIR 在轻量级、单次前向的 All-in-One Restoration 路线上具有很好的效率—效果平衡；扩散方法则依赖更强的生成先验，在真实纹理和复杂细节重建方面是另一种路线。

## 我的判断：创新有，但更像工程组合

AnyIR 的每个基础组件都不陌生：U-Net、注意力、门控卷积、FFT、跳跃连接和全局残差都已有大量研究。它的贡献主要是把这些组件组合成一个针对统一图像恢复的轻量结构：

$$
\text{Skip-Split}
+\text{Global Attention}
+\text{GatedDA}
+\text{Spatial-Frequency Fusion}.
$$

论文消融结果说明组合确实有效：基础模块的平均 PSNR 为 30.85，加入 Skip-Split 后提升到 31.83，加入 GatedDA 后达到 32.13，全部组件结合后达到 32.83。也就是说，它并不是完全没有技术内容，但提升主要来自结构设计和模块协同，而不是新的数学理论或新的生成范式。

所以我会把 AnyIR 定位成一篇“轻量化架构论文”，而不是 Diffusion 理论论文。它最值得借鉴的地方是明确的工程目标：不用文本、不用 LLM、不用多轮扩散采样，仅用几百万参数就完成多任务修复。它的局限也同样明显：模块创新密度有限，和大型 Diffusion 方法的比较并不完全对等，未知退化泛化能力仍然依赖训练分布。

我的最终评价是：AnyIR 没有重新定义图像恢复，但把全局、局部、空间和频率信息压缩到一个相对高效的结构里。对于边缘部署和实时恢复，这种“把模型做小、把效率做实”的工作仍然有价值；如果从理论创新角度评价，它确实不如 RDBM 那样深。

原论文：[Any Image Restoration via Efficient Spatial-Frequency Degradation Adaptation](https://arxiv.org/abs/2504.14249)  
代码：[AnyIR GitHub](https://github.com/Amazingren/AnyIR)
